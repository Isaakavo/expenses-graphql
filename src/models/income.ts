import { sequilize } from '../database/client.js';
import {
  DataTypes,
  InferAttributes,
  InferCreationAttributes,
  Model,
} from 'sequelize';

interface Income
  extends Model<InferAttributes<Income>, InferCreationAttributes<Income>> {
  id: number;
  total: number;
  paymentDate: Date;
  comment: string;
  userId: string;
  createdAt: Date;
  updatedAt: Date;
}

export const Income = sequilize.define<Income>('income', {
  id: {
    type: DataTypes.BIGINT,
    primaryKey: true,
    autoIncrement: true,
  },
  total: {
    type: DataTypes.FLOAT,
    allowNull: false,
  },
  comment: {
    type: DataTypes.STRING,
    allowNull: true,
  },
  paymentDate: {
    type: DataTypes.DATE,
    allowNull: false,
  },
  userId: {
    type: DataTypes.STRING,
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
