import { DataTypes, Model, Sequelize } from 'sequelize';
import { CurrencyCode } from '../generated/graphql.js';

export class UserSettings extends Model {
  public userId!: string;
  public defaultCurrency!: CurrencyCode;
  public createdAt!: Date;
  public updatedAt!: Date;
}

export const initUserSettingsModel = (sequelize: Sequelize) => {
  UserSettings.init(
    {
      userId: {
        type: DataTypes.UUID,
        primaryKey: true,
        field: 'user_id',
      },
      defaultCurrency: {
        type: DataTypes.CHAR(3),
        allowNull: false,
        defaultValue: CurrencyCode.USD,
        field: 'default_currency',
      },
    },
    { sequelize, tableName: 'user_settings', underscored: true }
  );
};
