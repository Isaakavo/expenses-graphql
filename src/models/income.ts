import { sequilize } from '../database/client.js';
import { DataTypes } from 'sequelize';

export const Income = sequilize.define('Income', {
  total: {
    type: DataTypes.FLOAT,
    allowNull: false,
  },
  dateAdded: {
    type: DataTypes.DATE,
    allowNull: false,
  },
  paymentDate: {
    type: DataTypes.DATE,
    allowNull: false,
  },
});
