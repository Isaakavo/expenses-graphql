import { FindOptions, Op } from 'sequelize';
import {
  Card,
  Category,
  Expense,
  ExpenseWithCategory,
  SubCategory,
} from '../models/index.js';

export class ExpenseRepository {
  async getAllExpenses(userId: string, queryOptions?: FindOptions) {
    const { limit, where } = queryOptions ?? {};
    return (await Expense.findAll({
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
              where: {
                [Op.or]: [{ userId: null }, { userId }],
              },
            },
          ],
        },
        {
          model: Card,
          as: 'card',
        },
      ],
      order: [['payBefore', 'DESC']],
      limit,
    })) as ExpenseWithCategory[];
  }

  async getExpensesByPeriod(
    userId: string,
    periodId?: string,
    startDate?: Date,
    endDate?: Date
  ) { 
    const where: FindOptions['where'] = { userId };

    if (periodId) {
      where.periodId = periodId;
    } else if (startDate && endDate) {
      where.payBefore = {
        [Op.between]: [startDate, endDate],
      };
    }

    return (await Expense.findAll({
      where,
      include: [
        {
          model: SubCategory,
          as: 'sub_category',
          include: [
            {
              model: Category,
              as: 'category',
              where: {
                [Op.or]: [{ userId: null }, { userId }],
              },
            },
          ],
        },
        {
          model: Card,
          as: 'card',
        },
      ],
      order: [['payBefore', 'DESC']],
    })) as ExpenseWithCategory[];
  }
}
