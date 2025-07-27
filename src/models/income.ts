import { DataTypes, Model, Sequelize } from 'sequelize';

export class Income extends Model {
  public id!: string;
  public total!: number;
  public paymentDate!: Date;
  public comment!: string;
  public userId!: string;
  public createdAt!: Date;
  public updatedAt!: Date;
}

export const initIncomeModel = (sequelize: Sequelize) => {
  Income.init(
    {
      id: {
        type: DataTypes.UUID,
        defaultValue: DataTypes.UUIDV4,
        primaryKey: true,
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
    },
    { sequelize, underscored: true }
  );
};
