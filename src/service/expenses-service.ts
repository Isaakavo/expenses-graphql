import { adaptExpensesWithCard } from '../adapters/income-adapter.js';
import { CardRepository } from '../repository/card-repository.js';
import { ExpenseRepository } from '../repository/expense-repository.js';
import { FindOptions } from 'sequelize';

export class ExpensesService {
  private expenseRepository = new ExpenseRepository();
  private cardRepository = new CardRepository();

  async getAllExpenses(userId: string, queryOptions?: FindOptions) {
    const expenses = await this.expenseRepository.getAllExpenses(
      userId,
      queryOptions
    );

    return await Promise.all(
      expenses.map(async (expense) => {
        const expenseCard = await this.cardRepository.findCardByUserId(
          userId,
          expense.id
        );

        return adaptExpensesWithCard(expense, undefined, expenseCard);
      })
    );
  }
}
