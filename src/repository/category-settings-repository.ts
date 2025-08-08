import { Category } from '../models/category.js';
import { CategorySettings, CategorySettingsWithCategory } from '../models/category-settings.js';
import { Sequelize } from 'sequelize';

export class CategorySettingsRepository {
  userId: string;
  sequelize: Sequelize;

  constructor(userId: string, sequelize: Sequelize) {
    this.userId = userId;
    this.sequelize = sequelize;
  }

  async getCategorySettings() {
    return CategorySettings.findAll({
      where: { userId: this.userId },
      include: [{ model: Category, as: 'category' }],
    }) as Promise<CategorySettingsWithCategory[]>;
  }

  async createCategorySetting(categorySettingData: Partial<CategorySettings>) {
    return CategorySettings.create({
      ...categorySettingData,
      userId: this.userId,
    });
  }
}
