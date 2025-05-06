import { adaptExpensesWithCard } from '../adapters/income-adapter.js';
import { CardRepository } from '../repository/card-repository.js';
import { ExpenseRepository } from '../repository/expense-repository.js';
import { WhereOptions } from 'sequelize';

export class ExpensesService {
  private expenseRepository = new ExpenseRepository();
  private cardRepository = new CardRepository();

  async getAllExpenses(userId: string, where: WhereOptions = {}) {
    const expenses = await this.expenseRepository.getAllExpenses(userId, where);

    return await Promise.all(
      expenses.map(async (expense) => {
        const expenseCard = await this.cardRepository.findCardByUserId(
          userId,
          expense.id
        );
        return adaptExpensesWithCard(expense, expenseCard);
      })
    );
  }
}
