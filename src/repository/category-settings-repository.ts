import {Category} from '../models/category.js';
import {CategorySettings, CategorySettingsWithCategory} from '../models/category-settings.js';
import {Sequelize, Transaction} from 'sequelize';
import {logger} from '../logger.js';
import {adaptCategorySettingDTO} from '../adapters/category-adapter.js';

export class CategorySettingsRepository {
  userId: string;
  sequelize: Sequelize;

  constructor(userId: string, sequelize: Sequelize) {
    this.userId = userId;
    this.sequelize = sequelize;
  }

  async getCategorySettings() {
    return CategorySettings.findAll({
      where: {userId: this.userId},
      include: [{model: Category, as: 'category'}],
    }) as Promise<CategorySettingsWithCategory[]>;
  }

  async createCategorySetting(categorySettingData: Partial<CategorySettings>) {
    return CategorySettings.create({
      ...categorySettingData,
      userId: this.userId,
    });
  }

  async updateCategorySetting(
    id: string,
    percentage: number,
    options: { transaction?: Transaction } = {}
  ) {
    const updated = await CategorySettings.update(
      {
        percentage
      },
      {
        where: {
          userId: this.userId,
          id
        },
        returning: true,
        validate: true,
        transaction: options.transaction
      }
    )

    logger.info(`Updated category setting id ${id} for user ${this.userId}`)

    if (updated[1].length === 0) {
      throw new Error('Category setting id not found')
    }

    return await this.getCategorySettingByPk(updated[1][0].id)
  }

  async deleteCategorySetting(categoryId: string) {
    return CategorySettings.destroy({
      where: {
        userId: this.userId,
        id: categoryId
      }
    })
  }

  async getCategorySettingByPk(id: string, options: { transaction?: Transaction } = {}) {
    const setting = await CategorySettings.findByPk(id,
      {
        transaction: options.transaction
      }
    )

    return adaptCategorySettingDTO(setting)
  }
}
