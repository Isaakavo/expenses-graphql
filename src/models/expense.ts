import { DataTypes, ForeignKey, Model, Sequelize } from 'sequelize';
import { Card } from './card';
import { SubCategory } from './sub-category.js';
import { Category } from './category.js';

export type ExpenseWithCategory = Expense & {
  card: Card;
  sub_category: SubCategory & {
    category: Category;
  };
};


//TODO include a column for check (if a paymet was already done and when it was done)
export class Expense extends Model {
  public id!: string;
  public userId!: string;
  public subCategoryId!: ForeignKey<string>;
  public concept!: string;
  public total!: number;
  public comments!: string;
  public payBefore!: Date;
  public createdAt!: Date;
  public updatedAt!: Date;
  public category!: string;
  declare cardId: ForeignKey<Card['id']>;
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
        type: DataTypes.STRING,
        allowNull: false,
      },
      subCategoryId: {
        type: DataTypes.UUID,
        allowNull: false,
        references: {
          model: 'sub_categories',
          key: 'id',
        },
        onDelete: 'SET NULL'
      },
      concept: {
        type: DataTypes.STRING,
        allowNull: false,
      },
      total: {
        type: DataTypes.FLOAT,
        allowNull: false,
      },
      comments: {
        type: DataTypes.STRING,
        allowNull: true,
      },
      payBefore: {
        type: DataTypes.DATE,
        allowNull: false,
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
}
