import {Op, Sequelize, Transaction} from 'sequelize';
import {IncomeCategoryAllocation} from '../models/income-category-allocation.js';
import {Category, Income} from '../models/index.js';
import {adaptIncomeCategoryAllocationDTO} from '../adapters/income-adapter.js';
import {logger} from '../logger.js';


export class CategoryAllocationRepository {
  userId: string;
  sequelize: Sequelize;

  constructor(userId: string, sequelize: Sequelize) {
    this.userId = userId;
    this.sequelize = sequelize;
  }

  async getCategoryAllocation(incomeId: string) {
    const result = await IncomeCategoryAllocation.findAll({
      include: [
        {
          model: Category,
          as: 'category',
          where: {
            [Op.or]: [{ userId: null }, { userId: this.userId }],
          },
        },
        {
          model: Income,
          as: 'income',
          where: { userId: this.userId, id: incomeId },
        },
      ],
      where: { incomeId, userId: this.userId },
    });

    return result.map((row) => adaptIncomeCategoryAllocationDTO(row));
  }

  async updateCategoryAllocation(
    id: string,
    percentage: number,
    amountAllocated: number,
    options: { transaction?: Transaction } = {}
  ) {
    const updated = await IncomeCategoryAllocation.update(
      {
        percentage,
        amountAllocated,
      },
      {
        where: {
          userId: this.userId,
          id,
        },
        returning: true,
        validate: true,
        transaction: options.transaction,
      }
    );

    logger.info(
      `Updated income category allocation id ${id} for user ${this.userId}`
    );

    if (updated[1].length === 0) {
      throw new Error('Income category allocation id not found');
    }

    return await this.getCategoryAllocationByPk(updated[1][0].id, options);
  }

  async getCategoryAllocationByPk(
    id: string,
    options: { transaction?: Transaction } = {}
  ) {
    const allocation = await IncomeCategoryAllocation.findByPk(id, {
      include: [
        { model: Category, as: 'category' },
        { model: Income, as: 'income' },
      ],
      transaction: options.transaction,
    });

    return adaptIncomeCategoryAllocationDTO(allocation);
  }
}