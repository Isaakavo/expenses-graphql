import { adaptExpenses } from '../adapters/income-adapter.js';
import { ExpenseRepository } from '../repository/expense-repository.js';
import { FindOptions } from 'sequelize';

export class ExpensesService {
  private expenseRepository = new ExpenseRepository();
  userId: string;

  constructor(userId: string) {
    this.userId = userId;
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
      this.userId,
      periodId,
      parsedStartDate,
      parsedEndDate
    );

    return await Promise.all(
      expenses.map(async (expense) => {
        return adaptExpenses(expense);
      })
    );
  }
}
