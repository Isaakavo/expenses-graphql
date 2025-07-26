import { Model, DataTypes, Sequelize } from 'sequelize';
import { sequelize } from '../database/client.js';

export class Period extends Model {
  public id!: string;
  public userId!: string;
  public startDate!: Date;
  public endDate!: Date;
  public type!: string;
  public createdAt!: Date;
  public updatedAt!: Date;
}

export const initPeriodModel = (sequelize: Sequelize) => {
  Period.init(
    {
      id: {
        type: DataTypes.UUID,
        defaultValue: DataTypes.UUIDV4,
        primaryKey: true,
      },
      userId: {
        type: DataTypes.STRING,
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
      type: {
        type: DataTypes.ENUM('weekly', 'fortnightly', 'monthly', 'custom'),
        allowNull: false,
      },
      createdAt: {
        type: DataTypes.DATE,
        allowNull: false,
        defaultValue: DataTypes.NOW,
      },
      updatedAt: {
        type: DataTypes.DATE,
      },
    },
    { sequelize, underscored: true }
  );
};
