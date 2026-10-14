import { Sequelize } from 'sequelize';
import type { Mock } from 'vitest';
import type { FixRate } from '../../../src/clients/banxico/fx-client.js';
import { CurrencyCode } from '../../../src/generated/graphql.js';
import { initModels } from '../../../src/models/init-models.js';
import { ExchangeRate } from '../../../src/models/exchange-rate.js';
import { ExchangeRateRepository } from '../../../src/repository/exchange-rate-repository.js';
import {
  EXCHANGE_RATE_UNAVAILABLE,
  FAILURE_THROTTLE_MS,
  ExchangeRateService,
  REFETCH_THROTTLE_MS,
} from '../../../src/service/exchange-rate-service.js';

const { MXN, USD } = CurrencyCode;

const NOON_MEXICO = new Date('2026-10-13T18:00:00Z');

let nowMs: number;
let fetchRates: Mock<(start: string, end: string) => Promise<FixRate[]>>;
let service: ExchangeRateService;

const cache = (rows: Record<string, number>) =>
  new ExchangeRateRepository().upsertMany(
    Object.entries(rows).map(([rateDate, rate]) => ({
      base: USD,
      quote: MXN,
      rateDate,
      rate,
      source: 'BANXICO_FIX',
    }))
  );

const fixed = (rows: Record<string, number>) =>
  Object.entries(rows).map(([rateDate, rate]) => ({ rateDate, rate }));

beforeEach(async () => {
  const sequelize = new Sequelize('sqlite::memory:', { logging: false });
  initModels(sequelize);
  await sequelize.sync({ force: true });
  nowMs = NOON_MEXICO.getTime();
  fetchRates = vi.fn<(start: string, end: string) => Promise<FixRate[]>>().mockResolvedValue([]);
  service = new ExchangeRateService({
    repository: new ExchangeRateRepository(),
    fetchRates,
    now: () => new Date(nowMs),
  });
});

describe('getRate', () => {
  it('returns the cached rate without calling Banxico when it is up to date', async () => {
    await cache({ '2026-10-12': 18.5, '2026-10-13': 18.6 });

    const result = await service.getRate(USD, MXN, '2026-10-13');

    expect(result).toMatchObject({ rateDate: '2026-10-13', rate: 18.6, stale: false });
    expect(fetchRates).not.toHaveBeenCalled();
  });

  it('falls back to the latest earlier rate on weekends', async () => {
    await cache({ '2026-10-09': 18.4 });

    const result = await service.getRate(USD, MXN, '2026-10-11');

    expect(result).toMatchObject({ rateDate: '2026-10-09', rate: 18.4, stale: false });
    expect(fetchRates).not.toHaveBeenCalled();
  });

  it('falls back to the latest earlier rate on a holiday and fetches only once', async () => {
    await cache({ '2026-10-09': 18.4 });

    const first = await service.getRate(USD, MXN, '2026-10-12');
    const second = await service.getRate(USD, MXN, '2026-10-12');

    expect(first).toMatchObject({ rateDate: '2026-10-09', stale: false });
    expect(second).toMatchObject({ rateDate: '2026-10-09', stale: false });
    expect(fetchRates).toHaveBeenCalledTimes(1);
  });

  it('derives the inverse rate', async () => {
    await cache({ '2026-10-13': 20 });

    const result = await service.getRate(MXN, USD, '2026-10-13');

    expect(result).toMatchObject({ base: MXN, quote: USD, rate: 0.05 });
  });

  it('returns 1 for the same currency without touching the cache or Banxico', async () => {
    const result = await service.getRate(USD, USD, '2026-10-13');

    expect(result).toMatchObject({ rate: 1, stale: false });
    expect(fetchRates).not.toHaveBeenCalled();
  });

  it('fetches only the missing range and caches it', async () => {
    await cache({ '2026-10-08': 18.3, '2026-10-09': 18.4 });
    fetchRates.mockResolvedValue(fixed({ '2026-10-12': 18.5, '2026-10-13': 18.6 }));

    const result = await service.getRate(USD, MXN, '2026-10-13');

    expect(fetchRates).toHaveBeenCalledExactlyOnceWith('2026-10-10', '2026-10-13');
    expect(result).toMatchObject({ rateDate: '2026-10-13', rate: 18.6, stale: false });
    expect(await ExchangeRate.count()).toBe(4);
  });

  it('looks back from the requested date when the cache is empty', async () => {
    fetchRates.mockResolvedValue(fixed({ '2026-10-13': 18.6 }));

    await service.getRate(USD, MXN, '2026-10-13');

    expect(fetchRates).toHaveBeenCalledExactlyOnceWith('2026-10-03', '2026-10-13');
  });

  it('does not fetch for dates in the future beyond today', async () => {
    await cache({ '2026-10-13': 18.6 });

    const result = await service.getRate(USD, MXN, '2026-12-25');

    expect(result.rateDate).toBe('2026-10-13');
    expect(fetchRates).not.toHaveBeenCalled();
  });

  it('returns the last cached rate as stale when Banxico fails', async () => {
    await cache({ '2026-10-09': 18.4 });
    fetchRates.mockRejectedValue(new Error('timeout'));

    const result = await service.getRate(USD, MXN, '2026-10-13');

    expect(result).toMatchObject({ rateDate: '2026-10-09', rate: 18.4, stale: true });
  });

  it('keeps reporting stale during the throttle window after a failure', async () => {
    await cache({ '2026-10-09': 18.4 });
    fetchRates.mockRejectedValue(new Error('timeout'));

    await service.getRate(USD, MXN, '2026-10-13');
    const second = await service.getRate(USD, MXN, '2026-10-13');

    expect(second.stale).toBe(true);
    expect(fetchRates).toHaveBeenCalledTimes(1);
  });

  it('throws EXCHANGE_RATE_UNAVAILABLE when Banxico fails and nothing is cached', async () => {
    fetchRates.mockRejectedValue(new Error('timeout'));

    await expect(service.getRate(USD, MXN, '2026-10-13')).rejects.toMatchObject({
      extensions: { code: EXCHANGE_RATE_UNAVAILABLE },
    });
  });

  it('refetches the missing day after the throttle window', async () => {
    await cache({ '2026-10-12': 18.5 });

    await service.getRate(USD, MXN, '2026-10-13');
    nowMs += REFETCH_THROTTLE_MS - 1;
    await service.getRate(USD, MXN, '2026-10-13');
    expect(fetchRates).toHaveBeenCalledTimes(1);

    nowMs += 1;
    fetchRates.mockResolvedValue(fixed({ '2026-10-13': 18.6 }));
    const result = await service.getRate(USD, MXN, '2026-10-13');

    expect(fetchRates).toHaveBeenCalledTimes(2);
    expect(result.rateDate).toBe('2026-10-13');
  });
});

describe('ensureRates', () => {
  it('does not share a throttle entry between windows that start on the same day', async () => {
    await service.ensureRates('2026-10-03', '2026-10-08', false);
    await service.ensureRates('2026-10-03', '2026-10-13', false);

    expect(fetchRates.mock.calls).toEqual([
      ['2026-10-03', '2026-10-08'],
      ['2026-10-03', '2026-10-13'],
    ]);
  });

  it('shares one in-flight request between concurrent identical calls', async () => {
    let release: (rates: FixRate[]) => void;
    fetchRates.mockReturnValue(new Promise((resolve) => (release = resolve)));

    const first = service.ensureRates('2026-10-03', '2026-10-13', false);
    const second = service.ensureRates('2026-10-03', '2026-10-13', false);
    await vi.waitFor(() => expect(fetchRates).toHaveBeenCalledTimes(1));
    release(fixed({ '2026-10-13': 18.6 }));

    const results = await Promise.all([first, second]);

    expect(fetchRates).toHaveBeenCalledTimes(1);
    expect(results[0]).toEqual(results[1]);
    expect(results[0].cachedDates).toEqual(['2026-10-13']);
  });

  it('retries a failed fetch after the short failure throttle', async () => {
    fetchRates.mockRejectedValueOnce(new Error('timeout'));
    await service.ensureRates('2026-10-03', '2026-10-13', false);

    nowMs += FAILURE_THROTTLE_MS - 1;
    await service.ensureRates('2026-10-03', '2026-10-13', false);
    expect(fetchRates).toHaveBeenCalledTimes(1);

    nowMs += 1;
    await service.ensureRates('2026-10-03', '2026-10-13', false);
    expect(fetchRates).toHaveBeenCalledTimes(2);
  });

  it('rethrows a cache error and retries after the short failure throttle', async () => {
    fetchRates.mockResolvedValue(fixed({ '2026-10-13': 18.6 }));
    const upsert = vi
      .spyOn(ExchangeRateRepository.prototype, 'upsertMany')
      .mockRejectedValueOnce(new Error('db down'));
    await expect(service.ensureRates('2026-10-03', '2026-10-13', false)).rejects.toThrow('db down');

    nowMs += FAILURE_THROTTLE_MS;
    await service.ensureRates('2026-10-03', '2026-10-13', false);
    expect(fetchRates).toHaveBeenCalledTimes(2);
    upsert.mockRestore();
  });

  it('reports only the dates that were not cached before', async () => {
    await cache({ '2026-10-09': 18.4 });
    fetchRates.mockResolvedValue(fixed({ '2026-10-12': 18.5, '2026-10-13': 18.6 }));

    const first = await service.ensureRates('2026-10-09', '2026-10-13', false);

    expect(first).toEqual({ cachedDates: ['2026-10-12', '2026-10-13'], failed: false });
  });

  it('does not duplicate rows when Banxico repeats a date', async () => {
    await cache({ '2026-10-09': 18.4 });
    fetchRates.mockResolvedValue(fixed({ '2026-10-12': 18.5, '2026-10-13': 18.6 }));
    await service.ensureRates('2026-10-09', '2026-10-13', false);

    const secondRun = new ExchangeRateService({
      repository: new ExchangeRateRepository(),
      fetchRates,
      now: () => new Date(nowMs),
    });
    await cache({ '2026-10-12': 18.5 });
    const result = await secondRun.ensureRates('2026-10-09', '2026-10-13', false);

    expect(result.cachedDates).toEqual([]);
    expect(await ExchangeRate.count()).toBe(3);
  });
});

describe('getRates', () => {
  it('returns one row per cached date in range, inverted when asked', async () => {
    await cache({ '2026-10-08': 20, '2026-10-09': 25, '2026-10-12': 10, '2026-10-13': 5 });

    const rows = await service.getRates(MXN, USD, '2026-10-09', '2026-10-12');

    expect(rows.map((row) => [row.rateDate, row.rate])).toEqual([
      ['2026-10-09', 0.04],
      ['2026-10-12', 0.1],
    ]);
    expect(fetchRates).not.toHaveBeenCalled();
  });

  it('fills the gap before the earliest cached date', async () => {
    await cache({ '2026-10-12': 18.5, '2026-10-13': 18.6 });
    fetchRates.mockResolvedValue(fixed({ '2026-10-07': 18.2, '2026-10-08': 18.3 }));

    const rows = await service.getRates(USD, MXN, '2026-10-07', '2026-10-13');

    expect(fetchRates).toHaveBeenCalledExactlyOnceWith('2026-10-06', '2026-10-11');
    expect(rows).toHaveLength(4);
  });

  it('returns stale rows when Banxico fails', async () => {
    await cache({ '2026-10-08': 18.3 });
    fetchRates.mockRejectedValue(new Error('timeout'));

    const rows = await service.getRates(USD, MXN, '2026-10-08', '2026-10-13');

    expect(rows).toEqual([expect.objectContaining({ rateDate: '2026-10-08', stale: true })]);
  });

  it('returns nothing for the same currency', async () => {
    expect(await service.getRates(USD, USD, '2026-10-08', '2026-10-13')).toEqual([]);
  });

  it('rejects an inverted range with a VALIDATION_ERROR on startDate', async () => {
    await expect(service.getRates(USD, MXN, '2026-10-13', '2026-10-08')).rejects.toMatchObject({
      extensions: { code: 'VALIDATION_ERROR', argumentName: 'startDate' },
    });
  });

  it('prepends the latest earlier rate when the range starts on a weekend', async () => {
    await cache({ '2026-10-09': 18.4, '2026-10-12': 18.5, '2026-10-13': 18.6 });

    const rows = await service.getRates(USD, MXN, '2026-10-10', '2026-10-13');

    expect(rows.map((row) => row.rateDate)).toEqual(['2026-10-09', '2026-10-12', '2026-10-13']);
  });

  it('fetches a seed day before a holiday start when nothing earlier is cached', async () => {
    await cache({ '2025-01-02': 20 });
    fetchRates.mockResolvedValue(fixed({ '2024-12-31': 19.9 }));

    const rows = await service.getRates(USD, MXN, '2025-01-01', '2025-01-02');

    expect(fetchRates).toHaveBeenCalledExactlyOnceWith('2024-12-31', '2025-01-01');
    expect(rows.map((row) => row.rateDate)).toEqual(['2024-12-31', '2025-01-02']);
  });

  it('never fetches before the floor', async () => {
    await cache({ '2022-08-01': 19.9, '2026-10-13': 18.6 });

    await service.getRates(USD, MXN, '2020-01-01', '2026-10-13');

    expect(fetchRates).not.toHaveBeenCalled();
    fetchRates.mockClear();

    const empty = await service.getRates(USD, MXN, '2020-01-01', '2021-01-01');
    expect(empty).toEqual([]);
    expect(fetchRates).not.toHaveBeenCalled();
  });
});

describe('backfill', () => {
  it('fetches in yearly chunks, upserts and is repeatable', async () => {
    fetchRates.mockImplementation(async (start: string) =>
      start === '2025-01-01'
        ? fixed({ '2025-12-31': 18.1 })
        : fixed({ '2025-01-02': 18.0 })
    );
    await cache({ '2025-01-02': 99 });

    const total = await service.backfill('2025-01-01', '2026-06-30');
    await service.backfill('2025-01-01', '2026-06-30');

    expect(fetchRates.mock.calls.slice(0, 2)).toEqual([
      ['2025-01-01', '2025-12-31'],
      ['2026-01-01', '2026-06-30'],
    ]);
    expect(total).toBe(2);
    expect(await ExchangeRate.count()).toBe(2);
    expect(Number((await ExchangeRate.findOne({ where: { rateDate: '2025-01-02' } })).rate)).toBe(18);
  });
});

describe('getConversionRate', () => {
  it('returns the stored rate as a 10-decimal string with the date of the cached row', async () => {
    await cache({ '2026-10-09': 18.4 });

    expect(await service.getConversionRate(USD, MXN, '2026-10-11')).toEqual({
      rate: '18.4000000000',
      rateDate: '2026-10-09',
    });
  });

  it('inverts the stored rate half-up at 10 decimals', async () => {
    await cache({ '2026-10-13': 16.384 });

    expect((await service.getConversionRate(MXN, USD, '2026-10-13')).rate).toBe('0.0610351563');
  });

  it('throws EXCHANGE_RATE_UNAVAILABLE when nothing is cached', async () => {
    fetchRates.mockRejectedValue(new Error('down'));

    await expect(service.getConversionRate(USD, MXN, '2026-10-13')).rejects.toMatchObject({
      extensions: { code: EXCHANGE_RATE_UNAVAILABLE },
    });
  });
});

describe('onRatesCached', () => {
  it('runs once with the newly cached dates and not when nothing new was cached', async () => {
    const onRatesCached = vi.fn().mockResolvedValue(undefined);
    service = new ExchangeRateService({
      repository: new ExchangeRateRepository(),
      fetchRates,
      now: () => new Date(nowMs),
      onRatesCached,
    });
    await cache({ '2026-10-09': 18.4 });
    fetchRates.mockResolvedValue(fixed({ '2026-10-12': 18.5, '2026-10-13': 18.6 }));

    await service.ensureRates('2026-10-09', '2026-10-13', false);
    nowMs += REFETCH_THROTTLE_MS;
    await service.ensureRates('2026-10-09', '2026-10-13', false);

    expect(onRatesCached).toHaveBeenCalledTimes(1);
    expect(onRatesCached).toHaveBeenCalledWith(['2026-10-12', '2026-10-13']);
  });

  it('does not fail the lookup when the hook throws', async () => {
    service = new ExchangeRateService({
      repository: new ExchangeRateRepository(),
      fetchRates,
      now: () => new Date(nowMs),
      onRatesCached: vi.fn().mockRejectedValue(new Error('boom')),
    });
    fetchRates.mockResolvedValue(fixed({ '2026-10-13': 18.6 }));

    expect(await service.getConversionRate(USD, MXN, '2026-10-13')).toMatchObject({
      rate: '18.6000000000',
    });
  });
});
