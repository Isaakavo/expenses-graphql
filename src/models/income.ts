import { sequilize } from '../database/client.js';
import {
  DataTypes,
  InferAttributes,
  InferCreationAttributes,
  Model,
} from 'sequelize';

interface Income
  extends Model<InferAttributes<Income>, InferCreationAttributes<Income>> {
  total: number;
  paymentDate: Date;
  userId: string;
  createdAt: Date;
  updatedAt: Date;
}

export const Income = sequilize.define<Income>('income', {
  total: {
    type: DataTypes.FLOAT,
    allowNull: false,
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
