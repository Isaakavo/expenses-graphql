import {
  DataTypes,
  InferAttributes,
  InferCreationAttributes,
  Model,
} from 'sequelize';
import { sequilize } from '../database/client.js';

interface ExpenseTags
  extends Model<
    InferAttributes<ExpenseTags>,
    InferCreationAttributes<ExpenseTags>
  > {
  pk_expenses_tags: number;
  expenseId: number;
  tagId: number;
}

export const ExpenseTags = sequilize.define<ExpenseTags>(
  'expensestags',
  {
    pk_expenses_tags: {
      type: DataTypes.BIGINT,
      primaryKey: true,
      autoIncrement: true,
    },
    expenseId: {
      type: DataTypes.BIGINT,
      allowNull: false,
    },
    tagId: {
      type: DataTypes.BIGINT,
      allowNull: false,
    },
  },
  { timestamps: false }
);
