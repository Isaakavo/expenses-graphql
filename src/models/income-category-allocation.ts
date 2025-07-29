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
      incomeId: {
        type: DataTypes.UUID,
        allowNull: false,
        references: {
          model: 'incomes',
          key: 'id',
        },
        onDelete: 'CASCADE'
      },
      categoryId: {
        type: DataTypes.UUID,
        allowNull: false,
        references: {
          model: 'categories',
          key: 'id',
        },
      },
      percentage: {
        type: DataTypes.FLOAT,
        allowNull: false,
        validate: {
          min: 0,
          max: 1,
        },
      },
      amountAllocated: {
        type: DataTypes.FLOAT,
        allowNull: false,
      },
    },
    { sequelize, modelName: 'IncomeCategoryAllocation' }
  );
};
