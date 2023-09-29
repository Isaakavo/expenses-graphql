import {
  DataTypes,
  InferAttributes,
  InferCreationAttributes,
  Model
} from 'sequelize';
import { sequilize } from '../database/client.js';

interface Expense
  extends Model<InferAttributes<Expense>, InferCreationAttributes<Expense>> {
  id: number;
  userId: string;
  concept: string;
  total: number;
  comments: string;
  payBefore: Date;
  createdAt: Date;
  updatedAt: Date;
}
//TODO include a column for check (if a paymet was already done and when it was done)
export const Expense = sequilize.define<Expense>('expense', {
  id: {
    type: DataTypes.BIGINT,
    primaryKey: true,
    autoIncrement: true,
  },
  userId: {
    type: DataTypes.STRING,
    allowNull: false
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
});
