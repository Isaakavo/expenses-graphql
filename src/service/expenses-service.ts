import { FindOptions, Sequelize } from 'sequelize';
import { ExpenseDTO } from '../dto';
import { ExpenseRepository } from '../repository/expense-repository.js';
import { logger } from '../logger.js';
import { PeriodRepository } from '../repository/period-repository.js';

export type ExpenseInput = {
  concept: string;
  total: number;
  cardId?: string;
  periodId: string;
  comments?: string;
  categoryId: string;
  subCategoryId: string;
};

export class ExpensesService {
  private expenseRepository: ExpenseRepository;
  private periodRepository: PeriodRepository;
  userId: string;
  sequelize: Sequelize;

  constructor(userId: string, sequelize?: Sequelize) {
    this.expenseRepository = new ExpenseRepository(userId, sequelize);
    this.periodRepository = new PeriodRepository(userId, sequelize);
    this.userId = userId;
    this.sequelize = sequelize;
  }

  async createExpense(input: ExpenseInput) {
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

    return await this.expenseRepository.createExpense(input);
  }

  async updateExpense(
    id: string,
    input: Partial<ExpenseInput & { payBefore: Date }>
  ) {
    const transaction = await this.sequelize.transaction();
    try {
      const period = await this.periodRepository.getPeriodBy(
        { date: input.payBefore },
        { transaction }
      );

      if(!period) {
        logger.error('No period found for the given payBefore date');
      }

      const updated = await this.expenseRepository.updateExpense(
        id,
        {
          ...input,
          periodId: period.id,
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
    return this.expenseRepository.getAllExpenses(this.userId, queryOptions);
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

  async getExpenseById(id: string) {
    return this.expenseRepository.getExpenseByPK(id);
  }

  calculateTotal(expenses: ExpenseDTO[]) {
    return expenses.reduce((acc, expense) => acc + expense.total, 0);
  }
}
