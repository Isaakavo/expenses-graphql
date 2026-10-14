import { DataTypes, Model, Sequelize } from 'sequelize';

export class ExchangeRate extends Model {
  public base!: string;
  public quote!: string;
  // DATEONLY columns are returned as 'yyyy-MM-dd' strings
  public rateDate!: string;
  // DECIMAL columns are returned as strings
  public rate!: string;
  public source!: string;
  public fetchedAt!: Date;
}

export const initExchangeRateModel = (sequelize: Sequelize) => {
  ExchangeRate.init(
    {
      base: { type: DataTypes.CHAR(3), primaryKey: true },
      quote: { type: DataTypes.CHAR(3), primaryKey: true },
      rateDate: { type: DataTypes.DATEONLY, primaryKey: true, field: 'rate_date' },
      rate: { type: DataTypes.DECIMAL(18, 8), allowNull: false },
      source: { type: DataTypes.STRING(20), allowNull: false },
      fetchedAt: {
        type: DataTypes.DATE,
        allowNull: false,
        defaultValue: DataTypes.NOW,
        field: 'fetched_at',
      },
    },
    { sequelize, tableName: 'exchange_rates', timestamps: false }
  );
};
