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
    percentage: number;
  }) {
    const { categoryId, percentage } = input;

    const allSettings = await this.getCategorySettings();

    // Sum of percentage validation
    const percentageTotal = allSettings.reduce((total, setting) => {
      return total + Number(setting.percentage);
    }, 0);

    if (percentageTotal + percentage > 1) {
      throw new Error('Total percentage exceeds 100%');
    }

    const categorySettingData = {
      userId: this.userId,
      categoryId,
      percentage,
    };
    return this.categorySettingsRepository.createCategorySetting(
      categorySettingData
    );
  }
}
