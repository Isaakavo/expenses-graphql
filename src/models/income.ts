import { DataTypes, Model, Sequelize } from 'sequelize';
import { IncomeCategoryAllocation } from './income-category-allocation.js';
import { Period } from './periods.js';
import { CurrencyCode } from '../generated/graphql.js';

export type IncomeWithPeriod = Income & {
  period_id: string;
};

export class Income extends Model {
  public id!: string;
  public total!: number;
  public currency!: CurrencyCode;
  public paymentDate!: Date;
  public comment!: string;
  public userId!: string;
  public periodId!: string;
  public createdAt!: Date;
  public updatedAt!: Date;
  public period?: Period;

  static associate() {
    this.belongsTo(Period, { foreignKey: 'periodId', as: 'period' });
    this.hasMany(IncomeCategoryAllocation, {
      foreignKey: 'incomeId',
      as: 'categoryAllocations',
    });
  }
}

export const initIncomeModel = (sequelize: Sequelize) => {
  Income.init(
    {
      id: {
        type: DataTypes.UUID,
        defaultValue: DataTypes.UUIDV4,
        primaryKey: true,
      },
      total: {
        type: DataTypes.FLOAT,
        allowNull: false,
      },
      currency: {
        type: DataTypes.CHAR(3),
        allowNull: false,
        defaultValue: CurrencyCode.USD,
      },
      comment: {
        type: DataTypes.STRING,
        allowNull: true,
      },
      paymentDate: {
        type: DataTypes.DATE,
        allowNull: false,
      },
      userId: {
        type: DataTypes.STRING,
        allowNull: false,
      },
      periodId: {
        type: DataTypes.UUID,
        allowNull: false,
        field: 'period_id',
      },
      createdAt: {
        type: DataTypes.DATE,
        allowNull: false,
      },
      updatedAt: {
        type: DataTypes.DATE,
      },
    },
    { sequelize, underscored: true }
  );
};
