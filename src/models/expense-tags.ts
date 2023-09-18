import { DataTypes } from 'sequelize';
import { sequilize } from '../database/client.js';

export const ExpenseTags = sequilize.define(
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
