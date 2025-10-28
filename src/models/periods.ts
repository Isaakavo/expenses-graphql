import { DataTypes, Model, Sequelize } from 'sequelize';
import { Expense } from './expense.js';
import { Income } from './income.js';
import { PeriodType } from '../dto/period-dto.js';

export class Period extends Model {
  public id!: string;
  public userId!: string;
  public type!: PeriodType;
  public startDate!: Date;
  public endDate!: Date;
  public createdAt!: Date;
  public updatedAt!: Date;

  static associate() {
    this.hasMany(Income);
    this.hasMany(Expense);
  }
}

export const initPeriodsModel = (sequelize: Sequelize) => {
  Period.init(
    {
      id: {
        type: DataTypes.UUID,
        defaultValue: DataTypes.UUIDV4,
        primaryKey: true,
      },
      userId: {
        type: DataTypes.UUID,
        allowNull: false,
        field: 'user_id',
      },
      type: {
        type: DataTypes.ENUM('WEEKLY', 'FORTNIGHTLY', 'MONTHLY'),
        allowNull: false,
      },
      startDate: {
        type: DataTypes.DATE,
        allowNull: false,
      },
      endDate: {
        type: DataTypes.DATE,
        allowNull: false,
      },
      createdAt: {
        type: DataTypes.DATE,
        allowNull: false,
      },
      updatedAt: {
        type: DataTypes.DATE,
        allowNull: false,
      },
    },
    { sequelize, underscored: true }
  );
};
