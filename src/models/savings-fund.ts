import { DataTypes, Model, Sequelize } from 'sequelize';
import { CurrencyCode } from '../generated/graphql.js';

export class SavingsFund extends Model {
  public id!: string;
  public userId!: string;
  public name!: string;
  public currency!: CurrencyCode;
  public createdAt!: Date;
  public updatedAt!: Date;
}

export const initSavingsFundModel = (sequelize: Sequelize) => {
  SavingsFund.init(
    {
      id: {
        type: DataTypes.UUID,
        defaultValue: DataTypes.UUIDV4,
        primaryKey: true,
      },
      userId: {
        type: DataTypes.UUID,
        allowNull: false,
        field: 'user_id',
      },
      name: {
        type: DataTypes.STRING(100),
        allowNull: false,
      },
      currency: {
        type: DataTypes.CHAR(3),
        allowNull: false,
      },
    },
    {
      sequelize,
      tableName: 'savings_funds',
      underscored: true,
      indexes: [{ name: 'savings_funds_user_id_idx', fields: ['user_id'] }],
    }
  );
};
