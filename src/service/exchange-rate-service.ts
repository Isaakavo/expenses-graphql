import { addDays, differenceInCalendarDays, format, getDay, parseISO } from 'date-fns';
import { formatInTimeZone } from 'date-fns-tz';
import { GraphQLError } from 'graphql';
import { fetchFixRates, FixRate } from '../clients/banxico/fx-client.js';
import { CurrencyCode } from '../generated/graphql.js';
import { logger } from '../logger.js';
import {
  ExchangeRateRepository,
  ExchangeRateRow,
} from '../repository/exchange-rate-repository.js';

export const EXCHANGE_RATE_UNAVAILABLE = 'EXCHANGE_RATE_UNAVAILABLE';
export const REFETCH_THROTTLE_MS = 30 * 60 * 1000;
export const FAILURE_THROTTLE_MS = 2 * 60 * 1000;
export const RATES_FLOOR = '2022-08-01';

const STORED_BASE = CurrencyCode.USD;
const STORED_QUOTE = CurrencyCode.MXN;
const BANXICO_FIX_SOURCE = 'BANXICO_FIX';
const SAME_CURRENCY_SOURCE = 'IDENTITY';
const NO_CACHE_LOOKBACK_DAYS = 10;
const BACKFILL_CHUNK_DAYS = 365;
const MEXICO_TIME_ZONE = 'America/Mexico_City';

export type ExchangeRateResult = {
  base: CurrencyCode;
  quote: CurrencyCode;
  rateDate: string;
  rate: number;
  source: string;
  stale: boolean;
};

export type EnsureRatesResult = {
  cachedDates: string[];
  failed: boolean;
};

type RateFetcher = (start: string, end: string) => Promise<FixRate[]>;
type Attempt = { at: number; failed: boolean };

const validationError = (message: string, argumentName: string) =>
  new GraphQLError(message, { extensions: { code: 'VALIDATION_ERROR', argumentName } });

const isoDate = (date: Date) => format(date, 'yyyy-MM-dd');
const shiftDays = (date: string, days: number) => isoDate(addDays(parseISO(date), days));
const isBusinessDay = (date: string) => ![0, 6].includes(getDay(parseISO(date)));
const lastBusinessDayOnOrBefore = (date: string): string =>
  isBusinessDay(date) ? date : lastBusinessDayOnOrBefore(shiftDays(date, -1));
export class ExchangeRateService {
  private repository: ExchangeRateRepository;
  private fetchRates: RateFetcher;
  private now: () => Date;
  private attempts = new Map<string, Attempt>();
  private inFlight = new Map<string, Promise<EnsureRatesResult>>();

  constructor(
    repository: ExchangeRateRepository = new ExchangeRateRepository(),
    fetchRates: RateFetcher = fetchFixRates,
    now: () => Date = () => new Date()
  ) {
    this.repository = repository;
    this.fetchRates = fetchRates;
    this.now = now;
  }

  today(): string {
    return formatInTimeZone(this.now(), MEXICO_TIME_ZONE, 'yyyy-MM-dd');
  }

  async getRate(
    base: CurrencyCode,
    quote: CurrencyCode,
    date: string
  ): Promise<ExchangeRateResult> {
    if (base === quote) {
      return { base, quote, rateDate: date, rate: 1, source: SAME_CURRENCY_SOURCE, stale: false };
    }
    const { failed } = await this.ensureRates(
      shiftDays(date, -NO_CACHE_LOOKBACK_DAYS),
      date,
      false
    );
    const row = await this.repository.findLatestOnOrBefore(STORED_BASE, STORED_QUOTE, date);
    if (!row) {
      throw new GraphQLError('Exchange rate unavailable', {
        extensions: { code: EXCHANGE_RATE_UNAVAILABLE },
      });
    }
    return this.orient(row, base, quote, failed);
  }

  async getRates(
    base: CurrencyCode,
    quote: CurrencyCode,
    startDate: string,
    endDate: string
  ): Promise<ExchangeRateResult[]> {
    if (startDate > endDate) {
      throw validationError('startDate must not be after endDate', 'startDate');
    }
    const start = startDate < RATES_FLOOR ? RATES_FLOOR : startDate;
    if (base === quote || start > endDate) {
      return [];
    }
    const { failed } = await this.ensureRates(start, endDate, true);
    const rows = await this.repository.findBetween(STORED_BASE, STORED_QUOTE, start, endDate);
    const seed = await this.repository.findLatestOnOrBefore(STORED_BASE, STORED_QUOTE, start);
    const withSeed = seed && seed.rateDate < start ? [seed, ...rows] : rows;
    return withSeed.map((row) => this.orient(row, base, quote, failed));
  }

  async ensureRates(
    requestedStart: string,
    endDate: string,
    fillBefore: boolean
  ): Promise<EnsureRatesResult> {
    const end = endDate < this.today() ? endDate : this.today();
    const startDate = requestedStart < RATES_FLOOR ? RATES_FLOOR : requestedStart;
    const latestBusinessDay = lastBusinessDayOnOrBefore(end);
    const seedDay = lastBusinessDayOnOrBefore(shiftDays(startDate, -1));
    const leadingStart = seedDay < RATES_FLOOR ? RATES_FLOOR : seedDay;
    const latest = await this.repository.findLatestOnOrBefore(STORED_BASE, STORED_QUOTE, end);
    const earliest = await this.repository.findEarliestDate(STORED_BASE, STORED_QUOTE);

    const windows: [string, string][] = [
      ...(!latest && startDate <= end ? [[startDate, end] as [string, string]] : []),
      ...(latest && latest.rateDate < latestBusinessDay
        ? [[shiftDays(latest.rateDate, 1), latestBusinessDay] as [string, string]]
        : []),
      ...(latest && fillBefore && earliest && earliest > startDate && leadingStart < earliest
        ? [[leadingStart, shiftDays(earliest, -1)] as [string, string]]
        : []),
    ];

    return windows.reduce<Promise<EnsureRatesResult>>(
      async (previous, [windowStart, windowEnd]) => {
        const result = await previous;
        const window = await this.fillWindow(windowStart, windowEnd);
        return {
          cachedDates: [...result.cachedDates, ...window.cachedDates],
          failed: result.failed || window.failed,
        };
      },
      Promise.resolve({ cachedDates: [], failed: false })
    );
  }

  async backfill(from: string, to: string): Promise<number> {
    const chunkStarts = [...Array(Math.floor(differenceInCalendarDays(parseISO(to), parseISO(from)) / BACKFILL_CHUNK_DAYS) + 1).keys()]
      .map((i) => shiftDays(from, i * BACKFILL_CHUNK_DAYS));
    return chunkStarts.reduce<Promise<number>>(async (previous, chunkStart) => {
      const total = await previous;
      const chunkEnd = [shiftDays(chunkStart, BACKFILL_CHUNK_DAYS - 1), to].sort()[0];
      const fetched = await this.fetchRates(chunkStart, chunkEnd);
      await this.repository.upsertMany(fetched.map(this.toStoredRow));
      logger.info(`Backfill ${chunkStart}..${chunkEnd}: ${fetched.length} rates`);
      return total + fetched.length;
    }, Promise.resolve(0));
  }

  private toStoredRow = ({ rateDate, rate }: FixRate): ExchangeRateRow => ({
    base: STORED_BASE,
    quote: STORED_QUOTE,
    rateDate,
    rate,
    source: BANXICO_FIX_SOURCE,
  });

  private fillWindow(start: string, end: string): Promise<EnsureRatesResult> {
    const key = `${start}..${end}`;
    const running = this.inFlight.get(key);
    if (running) {
      return running;
    }
    const previous = this.attempts.get(key);
    const throttle = previous?.failed ? FAILURE_THROTTLE_MS : REFETCH_THROTTLE_MS;
    if (previous && this.now().getTime() - previous.at < throttle) {
      return Promise.resolve({ cachedDates: [], failed: previous.failed });
    }
    const request = this.fetchAndCache(key, start, end).finally(() =>
      this.inFlight.delete(key)
    );
    this.inFlight.set(key, request);
    return request;
  }

  private async fetchAndCache(
    key: string,
    start: string,
    end: string
  ): Promise<EnsureRatesResult> {
    const attempt: Attempt = { at: this.now().getTime(), failed: false };
    this.attempts.set(key, attempt);
    const fetched = await this.fetchRates(start, end).catch((error) => {
      attempt.failed = true;
      logger.warn(`Banxico FIX fetch ${start}..${end} failed: ${error.message}`);
      return null;
    });
    if (!fetched) {
      return { cachedDates: [], failed: true };
    }
    try {
      return { cachedDates: await this.cache(start, end, fetched), failed: false };
    } catch (error) {
      attempt.failed = true;
      throw error;
    }
  }

  private async cache(start: string, end: string, fetched: FixRate[]): Promise<string[]> {
    const existing = new Set(
      (await this.repository.findBetween(STORED_BASE, STORED_QUOTE, start, end)).map(
        (row) => row.rateDate
      )
    );
    await this.repository.upsertMany(fetched.map(this.toStoredRow));
    return fetched.map((rate) => rate.rateDate).filter((date) => !existing.has(date));
  }

  private orient(
    row: ExchangeRateRow,
    base: CurrencyCode,
    quote: CurrencyCode,
    stale: boolean
  ): ExchangeRateResult {
    const inverted = base !== STORED_BASE;
    return {
      base,
      quote,
      rateDate: row.rateDate,
      rate: inverted ? 1 / row.rate : row.rate,
      source: row.source,
      stale,
    };
  }
}

export const exchangeRateService = new ExchangeRateService();
