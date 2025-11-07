import {
  ExpenseDTO,
  ExpenseWithCategoryAllocationDTO,
  ExpenseWithCategoryRaw,
  GroupedExpensesDTO,
} from '../dto';
import { FindOptions, Op, QueryTypes, Sequelize, Transaction } from 'sequelize';
import {
  adaptExpenseWithCategoryAllocationDTO,
  adaptGroupedExpensesDTO,
  adaptRawListExpense,
  adaptSingleRawExpenseDTO,
} from '../adapters/expense-adapter.js';
import { Card, Category, Expense, SubCategory } from '../models/index.js';
import { ExpenseInput } from '../service/expenses-service.js';
import { toCamelCaseDeep } from '../utils/case-converter.js';
import { logger } from '../logger.js';

export class ExpenseRepository {
  userId: string;
  sequelizeClient: Sequelize;

  constructor(userId: string, sequelizeClient?: Sequelize) {
    this.userId = userId;
    this.sequelizeClient = sequelizeClient;
  }

  async createExpense(input: ExpenseInput) {
    const expense = await Expense.create({
      userId: this.userId,
      ...input,
    });

    const createdExpense = await this.getExpenseByPK(expense.id);

    return adaptSingleRawExpenseDTO(createdExpense);
  }

  async updateExpense(
    id: string,
    input: Partial<ExpenseInput>,
    options: { transaction?: Transaction } = {}
  ) {
    const updatedExpense = await Expense.update(
      {
        ...input,
      },
      {
        where: {
          id,
          userId: this.userId,
        },
        returning: true,
        validate: true,
        transaction: options.transaction,
      }
    );

    logger.info(`Updated expense id ${id} for user ${this.userId}`);

    if (updatedExpense[1].length === 0) {
      throw new Error('Expense id not found');
    }

    return await this.getExpenseByPK(updatedExpense[1][0].id, {
      transaction: options.transaction,
    });
  }

  async deleteExpense(id: string) {
    const deletedCount = await Expense.destroy({
      where: {
        id,
        userId: this.userId,
      },
    });

    if (deletedCount === 0) {
      throw new Error('Expense id not found');
    }

    logger.info(`Deleted expense id ${id} for user ${this.userId}`);
    return true;
  }

  async getAllExpenses(
    userId: string,
    queryOptions?: FindOptions
  ): Promise<ExpenseDTO[]> {
    const { limit, where } = queryOptions ?? {};
    const response = await Expense.findAll({
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
    });

    return adaptRawListExpense(response as ExpenseWithCategoryRaw[]);
  }

  async getExpensesByPeriod(
    periodId?: string,
    startDate?: Date,
    endDate?: Date,
    subCategoryIds?: string[]
  ): Promise<ExpenseDTO[]> {
    const where: FindOptions['where'] = { userId: this.userId };

    if (periodId) {
      where.periodId = periodId;
    } else if (startDate && endDate) {
      where.payBefore = {
        [Op.between]: [startDate, endDate],
      };
    }

    const expenses = (await Expense.findAll({
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
            id: subCategoryIds
              ? { [Op.in]: subCategoryIds }
              : { [Op.ne]: null },
          },
        },
        {
          model: Card,
          as: 'card',
        },
      ],
      order: [['payBefore', 'DESC']],
    })) as ExpenseWithCategoryRaw[];

    return adaptRawListExpense(expenses);
  }

  async getGroupedExpenses(
    periodId?: string,
    startDate?: Date,
    endDate?: Date,
    limit?: number
  ): Promise<GroupedExpensesDTO[]> {
    const replacements: any = { userId: this.userId };
    let where = 'WHERE e.user_id = :userId';

    if (periodId) {
      where += ' AND e.period_id = :periodId';
      replacements.periodId = periodId;
    }

    if (startDate) {
      where += ' AND e.pay_before >= :startDate';
      replacements.startDate = startDate;
    }

    if (endDate) {
      where += ' AND e.pay_before <= :endDate';
      replacements.endDate = endDate;
    }

    const sql = `
     SELECT
      DATE_TRUNC('day', e.pay_before) AS date,
      SUM(e.total) AS total,
      COUNT(*) AS count,
      JSON_AGG(
        JSON_BUILD_OBJECT(
          'expense', e,
          'subCategory', sc,
          'category', c,
          'card', cd
        ) ORDER BY e.pay_before
      ) AS expenses
    FROM expenses e
    LEFT JOIN sub_categories sc ON e.sub_category_id = sc.id
	  LEFT JOIN categories c ON sc.category_id = c.id
    LEFT JOIN "Cards" cd ON e.card_id = cd.id
    ${where}
    GROUP BY DATE_TRUNC('day', e.pay_before)
    ORDER BY DATE_TRUNC('day', e.pay_before) DESC
    ${limit ? 'LIMIT :limit' : ''}
    `;

    const rows = await this.sequelizeClient.query(sql, {
      type: QueryTypes.SELECT,
      replacements: { ...replacements, limit },
      raw: true,
    });

    return toCamelCaseDeep(rows).map((row) => adaptGroupedExpensesDTO(row));
  }

  async getExpensesSumByCategory(
    periodId: string
  ): Promise<ExpenseWithCategoryAllocationDTO[]> {
    const result = await Expense.findAll({
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

    return result.map((row) => adaptExpenseWithCategoryAllocationDTO(row));
  }

  async getExpenseByPK(
    id: string,
    options: { transaction?: Transaction } = {}
  ) {
    const expense = await Expense.findByPk(id, {
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
      transaction: options.transaction,
    });
    return adaptSingleRawExpenseDTO(expense);
  }
}
