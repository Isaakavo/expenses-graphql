import { DataTypes, Model, Sequelize } from 'sequelize';

export class IncomeCategoryAllocation extends Model {}

export const initIncomeCategoryAllocationModel = (sequelize: Sequelize) => {
  IncomeCategoryAllocation.init(
    {
      id: {
        type: DataTypes.UUID,
        defaultValue: DataTypes.UUIDV4,
        primaryKey: true,
      },
      userId: {
        type: DataTypes.UUID,
        allowNull: false,
        field: 'user_id'
      },
      incomeId: {
        type: DataTypes.UUID,
        allowNull: false,
        field: 'income_id',
        references: {
          model: 'incomes',
          key: 'id',
        },
        onDelete: 'CASCADE'
      },
      categoryId: {
        type: DataTypes.UUID,
        allowNull: false,
        field: 'category_id',
        references: {
          model: 'categories',
          key: 'id',
        },
      },
      percentage: {
        type: DataTypes.DECIMAL(5, 2),
        allowNull: false,
        validate: {
          min: 0,
          max: 100,
        },
      },
      amountAllocated: {
        type: DataTypes.DECIMAL(12, 2),
        allowNull: false,
        field: 'amount_allocated'
      },
    },
    { sequelize, underscored: true }
  );
};
