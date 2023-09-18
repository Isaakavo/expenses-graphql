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
  concept: string;
  total: number;
  comments: string;
  createdAt: Date;
  updatedAt: Date;
}

export const Expense = sequilize.define<Expense>('expense', {
  id: {
    type: DataTypes.BIGINT,
    primaryKey: true,
    autoIncrement: true,
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
  createdAt: {
    type: DataTypes.DATE,
    allowNull: false,
  },
  updatedAt: {
    type: DataTypes.DATE,
  },
});
