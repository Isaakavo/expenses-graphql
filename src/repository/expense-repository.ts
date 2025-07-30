import { FindOptions } from 'sequelize';
import { Card, Category, Expense, ExpenseWithCategory, SubCategory } from '../models/index.js';

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
        {
          model: Card,
          as: 'card',
        }
      ],
      order: [['payBefore', 'DESC']],
      limit,
    }) as ExpenseWithCategory[];
  }
}
