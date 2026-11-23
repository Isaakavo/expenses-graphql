import { Sequelize } from 'sequelize';
import { GraphQLError } from 'graphql';
import { isValid, parseISO } from 'date-fns';
import {
  GoalInput,
  GoalLinkedExpenseRow,
  GoalReimbursementInput,
  GoalRepository,
} from '../repository/goal-repository.js';
import { SavingsFundRepository } from '../repository/savings-fund-repository.js';
import {
  GoalDTO,
  GoalReimbursementDTO,
  SavingsFundDTO,
} from '../dto/goal-dto.js';
import { ExpenseDTO } from '../dto/expense-dto.js';
import { CurrencyCode, GoalKind } from '../generated/graphql.js';
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
const MAX_COMMENT_LENGTH = 255;
const DEFAULT_FUND_NAME = 'Ahorros';
const DATE_REGEX = /^\d{4}-\d{2}-\d{2}$/;

export type GoalServiceInput = {
  name: string;
  kind?: GoalKind | null;
  targetAmount?: number | null;
  startDate: string;
  endDate?: string | null;
  currency?: CurrencyCode | null;
  fundId?: string | null;
  defaultCardId?: string | null;
};

export type GoalReimbursementServiceInput = {
  amount: number;
  receivedOn: string;
  comment?: string | null;
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

const isValidAmount = (amount: number) =>
  Number.isFinite(amount) && amount > 0 && amount <= MAX_TARGET_AMOUNT;

export class GoalService {
  goalRepository: GoalRepository;
  savingsFundRepository: SavingsFundRepository;
  userSettingsService: UserSettingsService;
  exchangeRates: ExchangeRateService = exchangeRateService;
  userId: string;

  constructor(userId: string, sequelize: Sequelize) {
    this.userId = userId;
    this.userSettingsService = new UserSettingsService(userId, sequelize);
    this.goalRepository = new GoalRepository(userId, sequelize);
    this.savingsFundRepository = new SavingsFundRepository(userId, sequelize);
  }

  private validateEndDate(startDate: string, endDate?: string | null) {
    if (endDate && endDate < startDate) {
      throw validationError(
        'End date must be on or after the start date',
        'endDate'
      );
    }
  }

  private validateTarget(
    kind: GoalKind,
    targetAmount?: number | null
  ): number | null {
    switch (kind) {
    case GoalKind.REIMBURSABLE:
      if (targetAmount != null) {
        throw validationError(
          'Reimbursable goals do not have a target amount',
          'targetAmount'
        );
      }
      return null;
    case GoalKind.SAVINGS:
      if (targetAmount == null || !isValidAmount(targetAmount)) {
        throw validationError(
          `Target amount must be greater than 0 and at most ${MAX_TARGET_AMOUNT}`,
          'targetAmount'
        );
      }
      return targetAmount;
    }
  }

  private validateAndNormalize(
    input: GoalServiceInput,
    kind: GoalKind
  ): GoalInput {
    const name = (input.name ?? '').trim();
    if (name.length < 1 || name.length > MAX_NAME_LENGTH) {
      throw validationError(
        `Name must be between 1 and ${MAX_NAME_LENGTH} characters`,
        'name'
      );
    }

    const targetAmount = this.validateTarget(kind, input.targetAmount);
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

  private async resolveFundId(
    kind: GoalKind,
    fundId?: string | null
  ): Promise<string | null> {
    switch (kind) {
    case GoalKind.SAVINGS:
      if (fundId != null) {
        throw validationError(
          'Only reimbursable goals belong to a savings fund',
          'fundId'
        );
      }
      return null;
    case GoalKind.REIMBURSABLE:
      if (fundId == null) {
        return (await this.getDefaultFund()).id;
      }
      if (!(await this.savingsFundRepository.getFundByPk(fundId))) {
        throw validationError('Savings fund not found', 'fundId');
      }
      return fundId;
    }
  }

  private async assertDefaultCard(kind: GoalKind, cardId?: string | null) {
    if (cardId == null) {
      return;
    }
    if (kind === GoalKind.SAVINGS) {
      throw validationError(
        'Only reimbursable goals have a default card',
        'defaultCardId'
      );
    }
    if (!(await this.goalRepository.cardExists(cardId))) {
      throw validationError('Card not found', 'defaultCardId');
    }
  }

  private validateReimbursement(
    input: GoalReimbursementServiceInput
  ): GoalReimbursementInput {
    const amount = Number.isFinite(input.amount)
      ? Number(formatDecimal(parseDecimal(input.amount, AMOUNT_SCALE), AMOUNT_SCALE))
      : NaN;
    if (!isValidAmount(amount)) {
      throw validationError(
        `Amount must be greater than 0 and at most ${MAX_TARGET_AMOUNT}`,
        'amount'
      );
    }
    const comment = input.comment?.trim() || null;
    if (comment != null && comment.length > MAX_COMMENT_LENGTH) {
      throw validationError(
        `comment must be at most ${MAX_COMMENT_LENGTH} characters`,
        'comment'
      );
    }

    return {
      amount,
      receivedOn: assertIsoDate(input.receivedOn, 'receivedOn'),
      comment,
    };
  }

  private async assertReimbursable(goalId: string): Promise<GoalDTO> {
    const goal = await this.assertGoalLinkable(goalId);
    if (goal.kind !== GoalKind.REIMBURSABLE) {
      throw validationError(
        'Reimbursements can only be added to reimbursable goals',
        'goalId'
      );
    }
    return goal;
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
    const kind = input.kind ?? GoalKind.SAVINGS;
    const data = this.validateAndNormalize(input, kind);
    const fundId = await this.resolveFundId(kind, input.fundId);
    await this.assertDefaultCard(kind, input.defaultCardId);

    return this.goalRepository.createGoal({
      ...data,
      kind,
      fundId,
      defaultCardId: input.defaultCardId ?? null,
      currency:
        data.currency ?? (await this.userSettingsService.getDefaultCurrency()),
    });
  }

  async updateGoal(
    input: GoalServiceInput & { id: string }
  ): Promise<GoalDTO> {
    const goal = await this.assertGoalLinkable(input.id);
    const data = this.validateAndNormalize(input, goal.kind);
    await this.assertDefaultCard(goal.kind, input.defaultCardId);
    if (
      goal.kind === GoalKind.REIMBURSABLE &&
      data.currency &&
      data.currency !== goal.currency &&
      (await this.goalRepository.countReimbursements(goal.id)) > 0
    ) {
      throw validationError(
        'The currency of a goal with reimbursements cannot change',
        'currency'
      );
    }

    return this.goalRepository.updateGoal(input.id, {
      ...data,
      ...(input.fundId != null && {
        fundId: await this.resolveFundId(goal.kind, input.fundId),
      }),
      ...('defaultCardId' in input && {
        defaultCardId: input.defaultCardId ?? null,
      }),
    });
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
    const goal = await this.assertGoalLinkable(id);
    if (goal.kind === GoalKind.REIMBURSABLE && (await this.hasActivity(id))) {
      throw new GraphQLError(
        'A reimbursable goal with expenses or reimbursements cannot be deleted, close it instead',
        { extensions: { code: 'REIMBURSABLE_GOAL_IN_USE' } }
      );
    }

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

  private async hasActivity(goalId: string): Promise<boolean> {
    const [expenses, reimbursements] = await Promise.all([
      this.goalRepository.countExpenses(goalId),
      this.goalRepository.countReimbursements(goalId),
    ]);
    return expenses > 0 || reimbursements > 0;
  }

  async getDefaultFund(): Promise<SavingsFundDTO> {
    return this.savingsFundRepository.getOrCreateFirstFund(
      DEFAULT_FUND_NAME,
      () => this.userSettingsService.getDefaultCurrency()
    );
  }

  async getSavingsFunds(): Promise<SavingsFundDTO[]> {
    return this.savingsFundRepository.getFunds();
  }

  async getReimbursementsGroupedByGoalIds(
    goalIds: readonly string[]
  ): Promise<GoalReimbursementDTO[][]> {
    const reimbursements =
      await this.goalRepository.getReimbursementsByGoalIds(goalIds);
    return goalIds.map((id) =>
      reimbursements.filter((reimbursement) => reimbursement.goalId === id)
    );
  }

  async addReimbursement(
    input: GoalReimbursementServiceInput & { goalId: string }
  ): Promise<GoalReimbursementDTO> {
    const data = this.validateReimbursement(input);
    await this.assertReimbursable(input.goalId);

    return this.goalRepository.addReimbursement(input.goalId, data);
  }

  async updateReimbursement(
    input: GoalReimbursementServiceInput & { id: string }
  ): Promise<GoalReimbursementDTO> {
    const data = this.validateReimbursement(input);

    return this.goalRepository.updateReimbursement(input.id, data);
  }

  async deleteReimbursement(id: string): Promise<boolean> {
    return this.goalRepository.deleteReimbursement(id);
  }
}
