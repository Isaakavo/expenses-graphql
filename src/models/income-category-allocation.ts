import { DataTypes, Model, Sequelize } from 'sequelize';
import { Category } from './category.js';
import { Income } from './income.js';

export class IncomeCategoryAllocation extends Model {
  public id!: string;
  public userId!: string;
  public incomeId!: string;
  public categoryId!: string;
  public percentage!: number;
  public amountAllocated!: number;

  static associate() {
    // Associations can be defined here
    this.belongsTo(Income, { foreignKey: 'incomeId', as: 'income' });
    this.belongsTo(Category, { foreignKey: 'categoryId', as: 'category' });
  }
}

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
