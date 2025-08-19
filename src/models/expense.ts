import { DataTypes, ForeignKey, Model, Sequelize } from 'sequelize';
import { Card } from './card.js';
import { SubCategory } from './sub-category.js';
import { Category } from './category.js';
import { Period } from './periods.js';

export type ExpenseWithCategory = Expense & {
  card: Card;
  sub_category: SubCategory & {
    category: Category;
  };
};

export class Expense extends Model {
  public id!: string;
  public userId!: string;
  public cardId!: ForeignKey<string>;
  public periodId!: ForeignKey<string>;
  public subCategoryId!: ForeignKey<string>;
  public concept!: string;
  public total!: number;
  public comments!: string;
  public payBefore!: Date;
  public createdAt!: Date;
  public updatedAt!: Date;

  static associate() {
    this.belongsTo(Card, { foreignKey: 'cardId', as: 'card' });
    this.belongsTo(SubCategory, {
      foreignKey: 'subCategoryId',
      as: 'sub_category',
    });
    this.belongsTo(Period, { foreignKey: 'periodId', as: 'period' });
  }
}

export function initExpenseModel(sequelize: Sequelize) {
  Expense.init(
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
      subCategoryId: {
        type: DataTypes.UUID,
        allowNull: false,
        field: 'sub_category_id',
        references: {
          model: 'sub_categories',
          key: 'id',
        },
        onDelete: 'SET NULL',
      },
      periodId: {
        type: DataTypes.UUID,
        allowNull: false,
        field: 'period_id',
        references: {
          model: 'periods',
          key: 'id',
        },
        onDelete: 'SET NULL',
      },
      concept: {
        type: DataTypes.STRING,
        allowNull: false,
      },
      total: {
        type: DataTypes.DECIMAL(12, 2),
        allowNull: false,
      },
      comments: {
        type: DataTypes.STRING,
        allowNull: true,
        field: 'comments',
      },
      payBefore: {
        type: DataTypes.DATE,
        allowNull: false,
        field: 'pay_before',
      },
      createdAt: {
        type: DataTypes.DATE,
        allowNull: false,
        field: 'created_at',
      },
      updatedAt: {
        type: DataTypes.DATE,
        field: 'updated_at',
      },
    },
    { sequelize, underscored: true }
  );
}
