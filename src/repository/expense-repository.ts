import { Expense } from '../models/expense.js';
import { FindOptions } from 'sequelize';

export class ExpenseRepository {
  async getAllExpenses(
    userId: string,
    queryOptions: FindOptions
  ) {
    const { limit, where } = queryOptions;
    return await Expense.findAll({
      where: {
        ...where,
        userId,
      },
      order: [['payBefore', 'DESC']],
      limit,
    });
  }
}
