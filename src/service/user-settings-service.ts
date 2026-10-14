import { Sequelize } from 'sequelize';
import { CurrencyCode, UserSettings } from '../generated/graphql.js';
import { UserSettingsRepository } from '../repository/user-settings-repository.js';

export class UserSettingsService {
  private userSettingsRepository: UserSettingsRepository;

  constructor(userId: string, sequelize?: Sequelize) {
    this.userSettingsRepository = new UserSettingsRepository(userId, sequelize);
  }

  getDefaultCurrency() {
    return this.userSettingsRepository.getDefaultCurrency();
  }

  async getSettings(): Promise<UserSettings> {
    return { defaultCurrency: await this.getDefaultCurrency() };
  }

  async updateSettings(input: {
    defaultCurrency: CurrencyCode;
  }): Promise<UserSettings> {
    return {
      defaultCurrency: await this.userSettingsRepository.setDefaultCurrency(
        input.defaultCurrency
      ),
    };
  }
}
