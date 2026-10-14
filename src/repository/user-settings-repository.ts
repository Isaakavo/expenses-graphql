import { Sequelize } from 'sequelize';
import { CurrencyCode } from '../generated/graphql.js';
import { UserSettings } from '../models/user-settings.js';

export const DEFAULT_CURRENCY = CurrencyCode.USD;

export class UserSettingsRepository {
  userId: string;
  sequelize: Sequelize;

  constructor(userId: string, sequelize?: Sequelize) {
    this.userId = userId;
    this.sequelize = sequelize;
  }

  async getDefaultCurrency(): Promise<CurrencyCode> {
    const settings = await UserSettings.findByPk(this.userId);
    return (settings?.defaultCurrency as CurrencyCode) ?? DEFAULT_CURRENCY;
  }

  async setDefaultCurrency(defaultCurrency: CurrencyCode): Promise<CurrencyCode> {
    await UserSettings.upsert({ userId: this.userId, defaultCurrency });
    return defaultCurrency;
  }
}
