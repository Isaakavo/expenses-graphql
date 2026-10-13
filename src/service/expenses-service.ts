import { addDays, addMonths } from 'date-fns';
import { FindOptions, Sequelize, Transaction } from 'sequelize';
import { ExpenseDTO } from '../dto';
import { GraphQLError } from 'graphql';
import { FixedExpenseFrequency, GoalRole } from '../generated/graphql.js';
import { ExpenseRepository } from '../repository/expense-repository.js';
import { GoalService } from './goal-service.js';
import { logger } from '../logger.js';
import {
  FORTNIGHTLY_NUMBER_OF_DAYS,
  PeriodRepository,
} from '../repository/period-repository.js';

export type ExpenseInput = {
  concept: string;
  total: number;
  cardId?: string;
  periodId?: string;
  payBefore?: Date;
  comments?: string;
  categoryId: string;
  subCategoryId: string;
  goalId?: string | null;
  goalRole?: GoalRole | null;
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
};

type GoalLink = { goalId?: string | null; goalRole?: GoalRole | null };

const validationError = (message: string, argumentName: string) =>
  new GraphQLError(message, {
    extensions: { code: 'VALIDATION_ERROR', argumentName },
  });

export class ExpensesService {
  private expenseRepository: ExpenseRepository;
  private periodRepository: PeriodRepository;
  private goalService: GoalService;
  userId: string;
  sequelize: Sequelize;

  constructor(userId: string, sequelize?: Sequelize) {
    this.expenseRepository = new ExpenseRepository(userId, sequelize);
    this.periodRepository = new PeriodRepository(userId, sequelize);
    this.goalService = new GoalService(userId, sequelize);
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

    const conceptLengthMax = 100;
    const { concept, total } = input;
    if (concept.length === 0) {
      // logger.error('Concept is empty');
      throw new Error('Concept must not be empty');
    }

    if (total === 0 || total < 0) {
      // logger.error('Total bad input');
      throw new Error('Total must not be negative or zero');
    }

    if (concept.length > conceptLengthMax) {
      // logger.error('concept error');
      throw new Error(`Concept lenght must be lower than ${conceptLengthMax}`);
    }

    if (!needsPeriod) {
      return await this.expenseRepository.createExpense(input);
    }

    // Resolved last so a rejected create leaves no orphan period
    const transaction = await this.sequelize.transaction();
    try {
      const periodId = await this.resolvePeriodId(input.payBefore, {
        transaction,
      });
      const created = await this.expenseRepository.createExpense(
        { ...input, periodId },
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

    const transaction = await this.sequelize.transaction();
    try {
      const periodId = await this.resolvePeriodId(input.payBefore, {
        transaction,
      });

      const updated = await this.expenseRepository.updateExpense(
        id,
        {
          ...input,
          periodId,
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

    const transaction = await this.sequelize.transaction();
    try {
      const expenses: ExpenseDTO[] = [];
      const baseDate = input.payBefore;

      for (let i = 0; i < input.numberOfRepetitions; i++) {
        const targetDate =
          input.frequency === FixedExpenseFrequency.MONTHLY
            ? addMonths(baseDate, i)
            : addDays(baseDate, FORTNIGHTLY_NUMBER_OF_DAYS * i);

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
