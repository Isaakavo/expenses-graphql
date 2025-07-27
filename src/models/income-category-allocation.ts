import { DataTypes, Model } from 'sequelize';

export class IncomeCategoryAllocation extends Model {}

export const initIncomeCategoryAllocationModel = (sequelize) => {
  IncomeCategoryAllocation.init(
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
      amount: {
        type: DataTypes.FLOAT,
        allowNull: false,
      },
    },
    { sequelize, modelName: 'IncomeCategoryAllocation' }
  );
};
