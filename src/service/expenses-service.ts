import { addDays, addMonths } from 'date-fns';
import { formatInTimeZone } from 'date-fns-tz';
import { FindOptions, Sequelize, Transaction } from 'sequelize';
import { ExpenseDTO, ForeignColumns } from '../dto';
import { CurrencyCode, FixedExpenseFrequency, GoalRole } from '../generated/graphql.js';
import { ExpenseRepository } from '../repository/expense-repository.js';
import { GoalService } from './goal-service.js';
import { IncomeRepository } from '../repository/income-repository.js';
import { UserSettingsService } from './user-settings-service.js';
import { logger } from '../logger.js';
import { Expense } from '../models/index.js';
import {
  AMOUNT_SCALE,
  convertAmount,
  deriveRate,
  formatDecimal,
  parseDecimal,
  RATE_SCALE,
} from '../utils/decimal.js';
import { validationError } from '../utils/validation-error.js';
import {
  BANXICO_FIX_SOURCE,
  ExchangeRateService,
  exchangeRateService,
} from './exchange-rate-service.js';
import {
  FORTNIGHTLY_NUMBER_OF_DAYS,
  PeriodRepository,
} from '../repository/period-repository.js';

export type ForeignAmountParams = {
  amount: number;
  currency: CurrencyCode;
  fixedRate: boolean;
};

export type ExpenseInput = {
  concept: string;
  total: number;
  currency?: CurrencyCode;
  cardId?: string;
  periodId?: string;
  payBefore?: Date;
  comments?: string;
  categoryId: string;
  subCategoryId: string;
  goalId?: string | null;
  goalRole?: GoalRole | null;
  foreignAmount?: ForeignAmountParams | null;
};

export type FixedExpenseInput = {
  concept: string;
  total: number;
  cardId?: string;
  payBefore: Date;
  comment?: string;
  categoryId: string;
  subCategoryId: string;
  goalId?: string | null;
  goalRole?: GoalRole | null;
  numberOfRepetitions: number;
  frequency: FixedExpenseFrequency;
  foreignAmount?: ForeignAmountParams | null;
};

type GoalLink = { goalId?: string | null; goalRole?: GoalRole | null };

type ForeignPlan = {
  patch: Partial<ForeignColumns> & { total?: number; currency?: CurrencyCode };
  keepStoredTotal: boolean;
};

type Conversion = { total: number; columns: ForeignColumns };

const MANUAL_SOURCE = 'MANUAL';
const MAX_AMOUNT = 9999999999.99;
const MAX_RATE = 10n ** BigInt(18);

const DOMESTIC_COLUMNS: ForeignColumns = {
  originalTotal: null,
  originalCurrency: null,
  exchangeRate: null,
  rateDate: null,
  rateSource: null,
  fixedRate: false,
};

const parseAmount = (value: number | null | undefined, argumentName: string) => {
  if (!Number.isFinite(value) || Math.abs(value) > MAX_AMOUNT) {
    throw validationError(
      `${argumentName} must be a number up to ${MAX_AMOUNT}`,
      argumentName
    );
  }
  return parseDecimal(value, AMOUNT_SCALE);
};

const isoDay = (date: Date) => formatInTimeZone(date, 'UTC', 'yyyy-MM-dd');

export class ExpensesService {
  private expenseRepository: ExpenseRepository;
  private periodRepository: PeriodRepository;
  private goalService: GoalService;
  private incomeRepository: IncomeRepository;
  private userSettingsService: UserSettingsService;
  private exchangeRates: ExchangeRateService = exchangeRateService;
  userId: string;
  sequelize: Sequelize;

  constructor(userId: string, sequelize?: Sequelize) {
    this.expenseRepository = new ExpenseRepository(userId, sequelize);
    this.periodRepository = new PeriodRepository(userId, sequelize);
    this.goalService = new GoalService(userId, sequelize);
    this.incomeRepository = new IncomeRepository(userId, sequelize);
    this.userSettingsService = new UserSettingsService(userId, sequelize);
    this.userId = userId;
    this.sequelize = sequelize;
  }

  private async assertGoalLink({ goalId, goalRole }: GoalLink) {
    if (goalId != null && goalRole == null) {
      throw validationError('goalRole is required when goalId is set', 'goalRole');
    }
    if (goalId == null && goalRole != null) {
      throw validationError('goalId is required when goalRole is set', 'goalId');
    }
    if (goalId != null) {
      await this.goalService.assertGoalLinkable(goalId);
    }
  }

  private async resolvePeriodId(
    date: Date,
    options: { transaction?: Transaction } = {}
  ): Promise<string> {
    const period = await this.periodRepository.getPeriodBy({ date }, options);
    if (period) {
      return period.id;
    }
    const created = await this.periodRepository.createPeriod(date, options);
    return created.id;
  }

  private async resolveCurrency(
    periodId: string,
    options: { transaction?: Transaction } = {}
  ): Promise<CurrencyCode> {
    return (
      (await this.incomeRepository.getCurrencyByPeriod(periodId, options)) ??
      (await this.userSettingsService.getDefaultCurrency())
    );
  }

  private async currencyFor(target: {
    periodId?: string;
    date?: Date;
  }): Promise<CurrencyCode> {
    const periodId =
      target.periodId ??
      (target.date
        ? (await this.periodRepository.getPeriodBy({ date: target.date }))?.id
        : undefined);
    return periodId
      ? this.resolveCurrency(periodId)
      : this.userSettingsService.getDefaultCurrency();
  }

  private async convert(
    foreign: ForeignAmountParams,
    context: { total?: number; payBefore: Date; bookCurrency: CurrencyCode }
  ): Promise<Conversion> {
    const { total, payBefore, bookCurrency } = context;
    if (foreign.currency === bookCurrency) {
      throw validationError(
        'foreignAmount currency must differ from the period currency',
        'foreignAmount'
      );
    }
    const original = parseAmount(foreign.amount, 'foreignAmount');
    if (original <= 0n) {
      throw validationError(
        'foreignAmount amount must be between 0.01 and 9999999999.99',
        'foreignAmount'
      );
    }

    const rateDay = isoDay(payBefore);
    const base = {
      originalTotal: formatDecimal(original, AMOUNT_SCALE),
      originalCurrency: foreign.currency,
      fixedRate: foreign.fixedRate,
    };

    if (foreign.fixedRate) {
      const charged = parseAmount(total, 'total');
      if (charged <= 0n) {
        throw validationError(
          'total is required and must be positive when foreignAmount.fixedRate is true',
          'total'
        );
      }
      const rate = deriveRate(charged, original);
      if (rate <= 0n || rate >= MAX_RATE) {
        throw validationError('total is out of range for the foreign amount', 'total');
      }
      return {
        total: Number(formatDecimal(charged, AMOUNT_SCALE)),
        columns: {
          ...base,
          exchangeRate: formatDecimal(rate, RATE_SCALE),
          rateDate: rateDay,
          rateSource: MANUAL_SOURCE,
        },
      };
    }

    const { rate, rateDate } = await this.exchangeRates.getConversionRate(
      foreign.currency,
      bookCurrency,
      rateDay
    );
    const converted = convertAmount(original, parseDecimal(rate, RATE_SCALE));
    if (converted <= 0n) {
      throw validationError(
        'foreignAmount converts to less than 0.01',
        'foreignAmount'
      );
    }
    return {
      total: Number(formatDecimal(converted, AMOUNT_SCALE)),
      columns: {
        ...base,
        exchangeRate: rate,
        rateDate,
        rateSource: BANXICO_FIX_SOURCE,
      },
    };
  }

  private isUnchanged(
    current: Expense,
    foreign: ForeignAmountParams,
    total: number | undefined,
    payBefore: Date
  ) {
    return (
      current.originalCurrency === foreign.currency &&
      current.fixedRate === foreign.fixedRate &&
      parseDecimal(current.originalTotal, AMOUNT_SCALE) ===
        parseAmount(foreign.amount, 'foreignAmount') &&
      isoDay(payBefore) === isoDay(current.payBefore) &&
      (!foreign.fixedRate ||
        total == null ||
        parseAmount(total, 'total') === parseDecimal(current.total, AMOUNT_SCALE))
    );
  }

  private async planForeignUpdate(
    current: Expense,
    payBefore: Date,
    total: number | undefined,
    foreign: ForeignAmountParams | null | undefined
  ): Promise<ForeignPlan> {
    const isForeign = current.originalCurrency != null;
    if (foreign === null) {
      return { patch: isForeign ? DOMESTIC_COLUMNS : {}, keepStoredTotal: false };
    }
    if (foreign === undefined && !isForeign) {
      return { patch: {}, keepStoredTotal: false };
    }

    const destination = await this.periodRepository.getPeriodBy({ date: payBefore });
    const periodChanges = destination?.id !== current.periodId;
    const bookCurrency = periodChanges
      ? await this.currencyFor({ periodId: destination?.id })
      : current.currency;
    if (isForeign && bookCurrency !== current.currency) {
      throw validationError(
        'A foreign expense cannot move to a period with another currency',
        'payBefore'
      );
    }

    if (foreign && !this.isUnchanged(current, foreign, total, payBefore)) {
      const converted = await this.convert(foreign, { total, payBefore, bookCurrency });
      return {
        patch: { total: converted.total, currency: bookCurrency, ...converted.columns },
        keepStoredTotal: false,
      };
    }
    if (!isForeign) {
      return { patch: {}, keepStoredTotal: false };
    }

    const dateChanged = isoDay(payBefore) !== isoDay(current.payBefore);
    const currentTotal = Number(current.total);
    const totalChanged =
      current.fixedRate &&
      total != null &&
      parseAmount(total, 'total') !== parseDecimal(current.total, AMOUNT_SCALE);
    if (!dateChanged && !totalChanged) {
      return { patch: {}, keepStoredTotal: true };
    }
    const converted = await this.convert(
      {
        amount: Number(current.originalTotal),
        currency: current.originalCurrency,
        fixedRate: current.fixedRate,
      },
      { total: totalChanged ? total : currentTotal, payBefore, bookCurrency }
    );
    return {
      patch: { total: converted.total, currency: bookCurrency, ...converted.columns },
      keepStoredTotal: false,
    };
  }

  private async convertNew(input: ExpenseInput): Promise<Conversion | null> {
    if (!input.foreignAmount) {
      return null;
    }
    return this.convert(input.foreignAmount, {
      total: input.total,
      payBefore: this.requirePayBefore(input.payBefore),
      bookCurrency: await this.currencyFor({
        periodId: input.periodId,
        date: input.payBefore,
      }),
    });
  }

  private async convertSeries(
    input: FixedExpenseInput,
    dates: Date[]
  ): Promise<Conversion[]> {
    if (!input.foreignAmount) {
      return [];
    }
    return dates.reduce<Promise<Conversion[]>>(async (previous, payBefore) => {
      const done = await previous;
      const converted = await this.convert(input.foreignAmount, {
        total: input.total,
        payBefore,
        bookCurrency: await this.currencyFor({ date: payBefore }),
      });
      return [...done, converted];
    }, Promise.resolve([]));
  }

  private requirePayBefore(payBefore: Date | undefined) {
    if (!payBefore) {
      throw validationError('payBefore is required', 'payBefore');
    }
    return payBefore;
  }

  async createExpense(input: ExpenseInput) {
    await this.assertGoalLink(input);
    const needsPeriod = !input.periodId;
    if (needsPeriod) {
      if (input.goalRole !== GoalRole.SPENDING) {
        throw validationError('periodId is required', 'periodId');
      }
      if (!input.payBefore) {
        throw validationError('payBefore is required', 'payBefore');
      }
    }

    const { foreignAmount, ...fields } = input;
    const conceptLengthMax = 100;
    const { concept, total } = fields;
    if (concept.length === 0) {
      // logger.error('Concept is empty');
      throw new Error('Concept must not be empty');
    }

    const derivesTotal = foreignAmount != null && !foreignAmount.fixedRate;
    if (!derivesTotal && (total === 0 || total < 0)) {
      // logger.error('Total bad input');
      throw new Error('Total must not be negative or zero');
    }

    if (concept.length > conceptLengthMax) {
      // logger.error('concept error');
      throw new Error(`Concept lenght must be lower than ${conceptLengthMax}`);
    }

    const converted = await this.convertNew(input);
    const write = {
      ...fields,
      ...(converted && { total: converted.total, ...converted.columns }),
    };

    if (!needsPeriod) {
      return await this.expenseRepository.createExpense({
        ...write,
        currency: await this.resolveCurrency(input.periodId),
      });
    }

    // Resolved last so a rejected create leaves no orphan period
    const transaction = await this.sequelize.transaction();
    try {
      const periodId = await this.resolvePeriodId(input.payBefore, {
        transaction,
      });
      const created = await this.expenseRepository.createExpense(
        {
          ...write,
          periodId,
          currency: await this.resolveCurrency(periodId, { transaction }),
        },
        { transaction }
      );
      await transaction.commit();
      return created;
    } catch (error) {
      await transaction.rollback();
      throw error;
    }
  }

  async updateExpense(
    id: string,
    input: Partial<ExpenseInput & { payBefore: Date }>
  ) {
    const goalKeys = (['goalId', 'goalRole'] as const).filter(
      (key) => key in input && input[key] !== undefined
    );
    if (goalKeys.length === 1) {
      throw validationError(
        'goalId and goalRole must be provided together',
        goalKeys[0] === 'goalId' ? 'goalRole' : 'goalId'
      );
    }
    if (goalKeys.length === 2) {
      await this.assertGoalLink(input);
    }

    const { foreignAmount, ...sentFields } = input;
    const fields = { ...sentFields };
    const current = await this.expenseRepository.getExpenseState(id);
    if (!current) {
      throw new Error('Expense id not found');
    }
    const { patch: foreignPatch, keepStoredTotal } = await this.planForeignUpdate(
      current,
      input.payBefore,
      input.total,
      foreignAmount
    );

    if (keepStoredTotal) {
      delete fields.total;
    }

    const transaction = await this.sequelize.transaction();
    try {
      const periodId = await this.resolvePeriodId(input.payBefore, {
        transaction,
      });

      const currentPeriodId = current.periodId;
      const currency =
        currentPeriodId && currentPeriodId !== periodId
          ? await this.resolveCurrency(periodId, { transaction })
          : undefined;

      const updated = await this.expenseRepository.updateExpense(
        id,
        {
          ...fields,
          periodId,
          ...(currency && { currency }),
          ...foreignPatch,
        },
        {
          transaction,
        }
      );
      await transaction.commit();
      return updated;
    } catch (error) {
      logger.error('Error updating expense: ' + error.message);
      await transaction.rollback();
      throw error;
    }
  }

  async deleteExpense(id: string) {
    return this.expenseRepository.deleteExpense(id);
  }

  async getAllExpenses(queryOptions?: FindOptions) {
    return this.expenseRepository.getAllExpenses(queryOptions);
  }

  async getExpensesByPeriod(
    periodId?: string,
    startDate?: Date,
    endDate?: Date,
    subCategoryIds?: string[]
  ) {
    const parsedStartDate = startDate ? new Date(startDate) : undefined;
    const parsedEndDate = endDate ? new Date(endDate) : undefined;

    const expenses = await this.expenseRepository.getExpensesByPeriod(
      periodId,
      parsedStartDate,
      parsedEndDate,
      subCategoryIds
    );

    const expensesTotal = this.calculateTotal(expenses);

    return {
      expenses,
      expensesTotal,
    };
  }

  async getExpensesGroupedExpenses(
    periodId?: string,
    startDate?: Date,
    endDate?: Date
  ) {
    const parsedStartDate = startDate ? new Date(startDate) : undefined;
    const parsedEndDate = endDate ? new Date(endDate) : undefined;

    const groupedExpenses = await this.expenseRepository.getGroupedExpenses(
      periodId,
      parsedStartDate,
      parsedEndDate
    );

    const expensesTotal = groupedExpenses.reduce(
      (acc, groupedExpense) => acc + groupedExpense.total,
      0
    );

    return {
      expenses: groupedExpenses,
      expensesTotal,
    };
  }

  async getExpensesByCategory(
    periodId?: string,
    startDate?: Date,
    endDate?: Date,
    subCategoryIds?: string[],
    cardId?: string
  ) {
    const parsedStartDate = startDate ? new Date(startDate) : undefined;
    const parsedEndDate = endDate ? new Date(endDate) : undefined;

    return this.expenseRepository.getExpensesByCategory(
      periodId,
      parsedStartDate,
      parsedEndDate,
      subCategoryIds,
      cardId
    );
  }

  async getExpenseById(id: string) {
    return this.expenseRepository.getExpenseByPK(id);
  }

  async createFixedExpenses(input: FixedExpenseInput) {
    await this.assertGoalLink(input);

    const baseDate = input.payBefore;
    const targetDates = [...Array(input.numberOfRepetitions).keys()].map((i) =>
      input.frequency === FixedExpenseFrequency.MONTHLY
        ? addMonths(baseDate, i)
        : addDays(baseDate, FORTNIGHTLY_NUMBER_OF_DAYS * i)
    );
    const conversions = await this.convertSeries(input, targetDates);

    const transaction = await this.sequelize.transaction();
    try {
      const expenses: ExpenseDTO[] = [];

      for (let i = 0; i < input.numberOfRepetitions; i++) {
        const targetDate = targetDates[i];

        let period = await this.periodRepository.getPeriodBy(
          { date: targetDate },
          { transaction }
        );

        if (!period) {
          const created = await this.periodRepository.createPeriod(
            targetDate,
            { transaction }
          );
          period = { id: created.id } as any;
        }

        const expense = await this.expenseRepository.createExpense(
          {
            concept: input.concept,
            total: input.total,
            ...(conversions[i] && {
              total: conversions[i].total,
              ...conversions[i].columns,
            }),
            currency: await this.resolveCurrency(period.id, { transaction }),
            cardId: input.cardId,
            periodId: period.id,
            categoryId: input.categoryId,
            subCategoryId: input.subCategoryId,
            comments: input.comment,
            goalId: input.goalId ?? null,
            goalRole: input.goalRole ?? null,
            payBefore: targetDate,
          },
          { transaction }
        );

        expenses.push(expense);
      }

      await transaction.commit();
      logger.info(
        `Created ${expenses.length} fixed expenses (${input.frequency})`
      );
      return expenses;
    } catch (error) {
      await transaction.rollback();
      logger.error('Error creating fixed expenses: ' + error.message);
      throw error;
    }
  }

  calculateTotal(expenses: ExpenseDTO[]) {
    return expenses.reduce((acc, expense) => acc + expense.total, 0);
  }
}
