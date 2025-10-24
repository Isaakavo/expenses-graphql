import { FindOptions, Op, Sequelize } from 'sequelize';
import {
  Card,
  Category,
  Expense,
  ExpenseWithCategory,
  SubCategory,
} from '../models/index.js';
import { ExpenseInput } from '../service/expenses-service.js';

export class ExpenseRepository {
  userId: string;

  constructor(userId: string) {
    this.userId = userId;
  }

  async createExpense(input: ExpenseInput) {
    const expense = await Expense.create({
      userId: this.userId,
      ...input,
    });

    return this.getExpenseByPK(expense.id);
  }

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
    periodId?: string,
    startDate?: Date,
    endDate?: Date,
    subCategoryIds?: string[],
  ) {
    const where: FindOptions['where'] = { userId: this.userId };

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
                [Op.or]: [{ userId: null }, { userId: this.userId }],
              },
            },
          ],
          // TODO add logic to handle how to get by category
          where: {
            id: subCategoryIds ? { [Op.in]: subCategoryIds } : { [Op.ne]: null },
          },
        },
        {
          model: Card,
          as: 'card',
        },
      ],
      order: [['payBefore', 'DESC']],
    })) as ExpenseWithCategory[];
  }

  async getExpensesSumByCategory(periodId: string) {
    return Expense.findAll({
      attributes: [
        [Sequelize.col('sub_category.category.name'), 'categoryName'],
        [Sequelize.col('sub_category.category.id'), 'categoryId'],
        [Sequelize.fn('SUM', Sequelize.col('Expense.total')), 'totalSpent'],
      ],
      include: [
        {
          model: SubCategory,
          as: 'sub_category',
          attributes: [],
          include: [
            {
              model: Category,
              as: 'category',
              attributes: [],
            },
          ],
        },
      ],
      where: { periodId, userId: this.userId },
      group: [
        Sequelize.col('sub_category.category.id'),
        Sequelize.col('sub_category.category.name'),
      ],
      raw: true,
    });
  }

  async getExpenseByPK(id: string) {
    return Expense.findByPk(id, {
      include: [
        {
          model: SubCategory,
          as: 'sub_category',
          include: [
            {
              model: Category,
              as: 'category',
              where: {
                [Op.or]: [{ userId: null }, { userId: this.userId }],
              },
            },
          ],
        },
        {
          model: Card,
          as: 'card',
        },
      ],
    });
  }
}
