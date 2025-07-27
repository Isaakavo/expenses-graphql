import {
  DataTypes,
  ForeignKey,
  Model,
  Sequelize
} from 'sequelize';
import { Card } from './card';
import { Category } from '../generated/graphql.js';

//TODO include a column for check (if a paymet was already done and when it was done)
export class Expense extends Model {
  public id!: string;
  public periodId!: string;
  public userId!: string;
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
      category: {
        type: DataTypes.ENUM(...Object.values(Category)),
        allowNull: false,
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
      periodId: {
        type: DataTypes.UUID,
        allowNull: false,
        references: { model: 'periods', key: 'id' },
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
