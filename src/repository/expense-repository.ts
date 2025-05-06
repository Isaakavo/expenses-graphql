import { Expense } from '../models/expense.js';
import { WhereOptions } from 'sequelize';

export class ExpenseRepository {
  async getAllExpenses(userId: string, where: WhereOptions = {}) {
    return await Expense.findAll({
      where: {
        ...where,
        userId,
      },
      order: [['payBefore', 'DESC']],
    });
  }
}
