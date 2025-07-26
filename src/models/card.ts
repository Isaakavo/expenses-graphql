import { Model, DataTypes, Sequelize } from 'sequelize';

export class Card extends Model {
  public id!: string;
  public userId!: string;
  public bank!: string;
  public alias!: string;
  public isDebit!: boolean;
  public isDigital!: boolean;
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
    },
    { sequelize }
  );
};
