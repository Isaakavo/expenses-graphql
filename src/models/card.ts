import { DataTypes, Model, Sequelize } from 'sequelize';
import { CurrencyCode } from '../generated/graphql.js';

export class Card extends Model {
  public id!: string;
  public userId!: string;
  public bank!: string;
  public alias!: string;
  public isDebit!: boolean;
  public isDigital!: boolean;
  public currency!: CurrencyCode | null;
}

export const initCardModel = (sequelize: Sequelize) => {
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
      currency: {
        type: DataTypes.CHAR(3),
        allowNull: true,
      },
    },
    { sequelize }
  );
};
