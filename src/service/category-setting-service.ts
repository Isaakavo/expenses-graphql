import { CategorySettingsRepository } from '../repository/category-settings-repository.js';
import { Sequelize } from 'sequelize';

export class CategorySettingsService {
  private categorySettingsRepository: CategorySettingsRepository;
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
  async createCategorySetting(input: any) {
    const { categoryId, percentage } = input;
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
