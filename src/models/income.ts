import { sequilize } from '../database/client.js';
import { DataTypes } from 'sequelize';

export const Income = sequilize.define('income', {
  total: {
    type: DataTypes.FLOAT,
    allowNull: false,
  },
  paymentDate: {
    type: DataTypes.DATE,
    allowNull: false,
  },
});
