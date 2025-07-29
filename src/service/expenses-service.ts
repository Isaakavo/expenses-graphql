import { SubCategory } from '../models/sub-category.js';
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

    const subCategories = await Promise.all(
      expenses.map(async (expense) => {
        const subCategory = await SubCategory.findByPk(expense.SubCategoryId);
        return subCategory;
      })
    );

    return await Promise.all(
      expenses.map(async (expense) => {
        const expenseCard = await this.cardRepository.findCardByUserId(
          userId,
          expense.id
        );
        const subCategory = subCategories.find(
          (subCat) => subCat.id === expense.SubCategoryId
        );
        return adaptExpensesWithCard(expense, subCategory.name, expenseCard);
      })
    );
  }
}
