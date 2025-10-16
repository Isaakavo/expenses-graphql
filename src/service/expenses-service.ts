import { FindOptions } from 'sequelize';
import { adaptExpenses } from '../adapters/income-adapter.js';
import { Expense } from '../models/expense.js';
import { ExpenseRepository } from '../repository/expense-repository.js';

export type ExpenseInput = {
  concept: string;
  total: number;
  cardId?: string;
  periodId: string;
  comment?: string;
  categoryId: string;
  subCategoryId: string
};

export class ExpensesService {
  private expenseRepository: ExpenseRepository;
  userId: string;

  constructor(userId: string) {
    this.expenseRepository = new ExpenseRepository(userId);
    this.userId = userId;
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

    const expense = await this.expenseRepository.createExpense(input);
    return adaptExpenses(expense);
  }

  async getAllExpenses(queryOptions?: FindOptions) {
    const expenses = await this.expenseRepository.getAllExpenses(
      this.userId,
      queryOptions
    );

    return await Promise.all(
      expenses.map(async (expense) => {
        return adaptExpenses(expense);
      })
    );
  }

  async getExpensesByPeriod(
    periodId?: string,
    startDate?: Date,
    endDate?: Date
  ) {
    const parsedStartDate = startDate ? new Date(startDate) : undefined;
    const parsedEndDate = endDate ? new Date(endDate) : undefined;

    const expenses = await this.expenseRepository.getExpensesByPeriod(
      periodId,
      parsedStartDate,
      parsedEndDate
    );

    const expensesTotal = this.calculateTotal(expenses);

    return {
      expenses: await Promise.all(
        expenses.map(async (expense) => {
          return adaptExpenses(expense);
        })
      ),
      expensesTotal,
    };
  }

  calculateTotal(expenses: Expense[]) {
    return expenses.reduce((acc, expense) => acc + expense.total, 0);
  }
}
