import { adaptExpenses } from '../adapters/income-adapter.js';
import { ExpenseRepository } from '../repository/expense-repository.js';
import { FindOptions } from 'sequelize';

export class ExpensesService {
  private expenseRepository = new ExpenseRepository();

  async getAllExpenses(userId: string, queryOptions?: FindOptions) {
    const expenses = await this.expenseRepository.getAllExpenses(
      userId,
      queryOptions
    );

    return await Promise.all(
      expenses.map(async (expense) => {
        return adaptExpenses(expense);
      })
    );
  }
}
