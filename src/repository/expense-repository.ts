import { Category } from '../models/category.js';
import { SubCategory } from '../models/sub-category.js';
import { Expense, ExpenseWithCategory } from '../models/expense.js';
import { FindOptions } from 'sequelize';

export class ExpenseRepository {
  async getAllExpenses(userId: string, queryOptions?: FindOptions) {
    const { limit, where } = queryOptions ?? {};
    return await Expense.findAll({
      where: {
        ...where,
        userId,
      },
      include: [
        {
          model: SubCategory,
          as: 'sub_category',
          include: [
            {
              model: Category,
              as: 'category',
            },
          ],
        },
      ],
      order: [['payBefore', 'DESC']],
      limit,
    }) as ExpenseWithCategory[];
  }
}
