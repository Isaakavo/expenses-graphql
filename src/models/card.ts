import { Model, DataTypes } from 'sequelize';
import { sequelize } from '../database/client.js';

export class Card extends Model {
  public id!: string;
  public userId!: string;
  public bank!: string;
  public alias!: string;
  public isDebit!: boolean;
  public isDigital!: boolean;
}

Card.init(
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
    // change with alias
    alias: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    bank: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    isDigital: {
      type: DataTypes.BOOLEAN,
    },
    isDebit: {
      type: DataTypes.BOOLEAN,
    },
  },
  { sequelize }
);
