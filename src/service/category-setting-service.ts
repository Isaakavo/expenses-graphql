import { CategorySettingsRepository } from '../repository/category-settings-repository.js';
import { Sequelize } from 'sequelize';

export class CategorySettingsService {
  categorySettingsRepository: CategorySettingsRepository;
  userId: string;

  constructor(userId: string, sequelize: Sequelize) {
    this.userId = userId;
    this.categorySettingsRepository = new CategorySettingsRepository(
      userId,
      sequelize
    );
  }

  async getCategorySettings() {
    return this.categorySettingsRepository.getCategorySettings();
  }

  //TODO add logic to validate that the percetage of the category does not exceed 100%
  // and that the category is not already set for the user
  async createCategorySetting(input: {
    categoryId: string;
    percentage: number | undefined;
    amount: number | undefined;
  }) {
    const { categoryId, percentage, amount } = input;

    const allSettings = await this.getCategorySettings();

    if (percentage) {
      // Sum of percentage validation
      const percentageTotal = allSettings.reduce((total, setting) => {
        return total + Number(setting.percentage);
      }, 0);
      if (percentageTotal + percentage > 1) {
        throw new Error('Total percentage exceeds 100%');
      }
    }

    const categorySettingData = {
      userId: this.userId,
      categoryId,
      percentage,
      amount
    };
    return this.categorySettingsRepository.createCategorySetting(
      categorySettingData
    );
  }

  async deleteCategorySetting(categoryId: string) {
    const deleted = await this.categorySettingsRepository.deleteCategorySetting(
      categoryId
    );

    if (deleted == 0) {
      return {
        id: '',
        message: 'Could not delete the setting',
      };
    }

    return {
      id: categoryId,
      message: 'Setting deleted',
    };
  }
}
