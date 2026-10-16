import { Sequelize } from 'sequelize';
import { GraphQLError } from 'graphql';
import { isValid, parseISO } from 'date-fns';
import {
  GoalInput,
  GoalLinkedExpenseRow,
  GoalRepository,
} from '../repository/goal-repository.js';
import { GoalDTO } from '../dto/goal-dto.js';
import { ExpenseDTO } from '../dto/expense-dto.js';
import { CurrencyCode } from '../generated/graphql.js';
import { logger } from '../logger.js';
import {
  AMOUNT_SCALE,
  convertAmount,
  formatDecimal,
  parseDecimal,
  RATE_SCALE,
} from '../utils/decimal.js';
import { formatCurrency } from '../adapters/income-adapter.js';
import {
  ExchangeRateService,
  exchangeRateService,
} from './exchange-rate-service.js';
import { UserSettingsService } from './user-settings-service.js';

const MAX_NAME_LENGTH = 100;
const MAX_TARGET_AMOUNT = 9999999999.99;
const DATE_REGEX = /^\d{4}-\d{2}-\d{2}$/;

export type GoalServiceInput = {
  name: string;
  targetAmount: number;
  startDate: string;
  endDate?: string | null;
  currency?: CurrencyCode | null;
};

const validationError = (message: string, argumentName: string) =>
  new GraphQLError(message, {
    extensions: { code: 'VALIDATION_ERROR', argumentName },
  });

const goalNotFound = () =>
  new GraphQLError('Goal not found', {
    extensions: { code: 'GOAL_NOT_FOUND' },
  });

// Dates are plain yyyy-MM-dd strings, no timezone conversion. Rejects 2026-02-30
const isValidIsoDate = (value: unknown): value is string =>
  typeof value === 'string' &&
  DATE_REGEX.test(value) &&
  isValid(parseISO(value)) &&
  new Date(`${value}T00:00:00Z`).toISOString().startsWith(value);

const assertIsoDate = (value: unknown, argumentName: string): string => {
  if (!isValidIsoDate(value)) {
    throw validationError(
      `${argumentName} must be a valid date in yyyy-MM-dd format`,
      argumentName
    );
  }
  return value;
};

export class GoalService {
  goalRepository: GoalRepository;
  userSettingsService: UserSettingsService;
  exchangeRates: ExchangeRateService = exchangeRateService;
  userId: string;

  constructor(userId: string, sequelize: Sequelize) {
    this.userId = userId;
    this.userSettingsService = new UserSettingsService(userId, sequelize);
    this.goalRepository = new GoalRepository(userId, sequelize);
  }

  private validateEndDate(startDate: string, endDate?: string | null) {
    if (endDate && endDate < startDate) {
      throw validationError(
        'End date must be on or after the start date',
        'endDate'
      );
    }
  }

  private validateAndNormalize(input: GoalServiceInput): GoalInput {
    const name = (input.name ?? '').trim();
    if (name.length < 1 || name.length > MAX_NAME_LENGTH) {
      throw validationError(
        `Name must be between 1 and ${MAX_NAME_LENGTH} characters`,
        'name'
      );
    }

    const { targetAmount } = input;
    if (
      !Number.isFinite(targetAmount) ||
      targetAmount <= 0 ||
      targetAmount > MAX_TARGET_AMOUNT
    ) {
      throw validationError(
        `Target amount must be greater than 0 and at most ${MAX_TARGET_AMOUNT}`,
        'targetAmount'
      );
    }

    const startDate = assertIsoDate(input.startDate, 'startDate');
    const endDate =
      input.endDate == null ? null : assertIsoDate(input.endDate, 'endDate');
    this.validateEndDate(startDate, endDate);

    return {
      name,
      targetAmount,
      startDate,
      endDate,
      ...(input.currency ? { currency: input.currency } : {}),
    };
  }

  async getGoalAmountsByExpenseIds(
    expenseIds: readonly string[]
  ): Promise<(string | null)[]> {
    const rows = await this.goalRepository.getGoalLinkedExpenseRows(expenseIds);
    const dayOf = (row: GoalLinkedExpenseRow) =>
      row.payBefore.toISOString().slice(0, 10);
    const needsRate = (row: GoalLinkedExpenseRow) =>
      row.currency !== row.goalCurrency &&
      row.originalCurrency !== row.goalCurrency;
    const rateKey = (row: GoalLinkedExpenseRow) =>
      `${row.currency}:${row.goalCurrency}:${dayOf(row)}`;

    const distinct = new Map(
      rows.filter(needsRate).map((row) => [rateKey(row), row])
    );
    const rates = new Map(
      await Promise.all(
        [...distinct].map(async ([key, row]) => {
          try {
            const { rate } = await this.exchangeRates.getConversionRate(
              row.currency,
              row.goalCurrency,
              dayOf(row)
            );
            return [key, parseDecimal(rate, RATE_SCALE)] as const;
          } catch (error) {
            logger.warn(
              `Goal amount rate unavailable for ${key}: ${error.message}`
            );
            return [key, null] as const;
          }
        })
      )
    );

    const amountOf = (row: GoalLinkedExpenseRow): string | null => {
      if (row.currency === row.goalCurrency) {
        return formatCurrency(Number(row.total));
      }
      if (row.originalCurrency === row.goalCurrency) {
        return formatCurrency(Number(row.originalTotal));
      }
      const rate = rates.get(rateKey(row));
      return rate == null
        ? null
        : formatCurrency(
          Number(
            formatDecimal(
              convertAmount(parseDecimal(row.total, AMOUNT_SCALE), rate),
              AMOUNT_SCALE
            )
          )
        );
    };

    const byId = new Map(rows.map((row) => [row.id, amountOf(row)]));
    return expenseIds.map((id) => byId.get(id) ?? null);
  }

  async getGoals(): Promise<GoalDTO[]> {
    return this.goalRepository.getGoals();
  }

  async getGoalById(id: string): Promise<GoalDTO | null> {
    return this.goalRepository.getGoalByPk(id);
  }

  async getExpensesGroupedByGoalIds(
    goalIds: readonly string[]
  ): Promise<ExpenseDTO[][]> {
    const expenses = await this.goalRepository.getExpensesByGoalIds(goalIds);
    const byGoal = new Map<string, ExpenseDTO[]>();
    for (const expense of expenses) {
      if (!expense.goalId) continue;
      const list = byGoal.get(expense.goalId);
      if (list) list.push(expense);
      else byGoal.set(expense.goalId, [expense]);
    }
    return goalIds.map((id) => byGoal.get(id) ?? []);
  }

  async createGoal(input: GoalServiceInput): Promise<GoalDTO> {
    const data = this.validateAndNormalize(input);

    return this.goalRepository.createGoal({
      ...data,
      currency:
        data.currency ?? (await this.userSettingsService.getDefaultCurrency()),
    });
  }

  async updateGoal(
    input: GoalServiceInput & { id: string }
  ): Promise<GoalDTO> {
    const data = this.validateAndNormalize(input);
    await this.assertGoalLinkable(input.id);

    return this.goalRepository.updateGoal(input.id, data);
  }

  async closeGoal(input: { id: string; endDate: string }): Promise<GoalDTO> {
    const goal = await this.goalRepository.getGoalByPk(input.id);
    if (!goal) {
      throw goalNotFound();
    }

    const endDate = assertIsoDate(input.endDate, 'endDate');
    this.validateEndDate(goal.startDate, endDate);

    return this.goalRepository.closeGoal(input.id, endDate);
  }

  async deleteGoal(id: string): Promise<boolean> {
    await this.assertGoalLinkable(id);

    return this.goalRepository.deleteGoal(id);
  }

  // Throws GOAL_NOT_FOUND when the goal doesn't exist or belongs to another user
  async assertGoalLinkable(goalId: string): Promise<GoalDTO> {
    const goal = await this.goalRepository.getGoalByPk(goalId);
    if (!goal) {
      throw goalNotFound();
    }

    return goal;
  }
}
