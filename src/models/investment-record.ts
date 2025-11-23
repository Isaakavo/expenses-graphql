import { DataTypes, Model, Sequelize } from 'sequelize';

export class InvestmentRecord extends Model {
  public id!: string;
  public userId!: string;
  public amount!: number;
  public udiAmount!: number;
  public udiValue!: number;
  public purchasedOn!: Date;
}

export function initInvestmentRecordModel(sequelize: Sequelize) {
  InvestmentRecord.init(
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
      amount: {
        type: DataTypes.DOUBLE,
        allowNull: false,
        field: 'purchase_total',
      },
      udiAmount: {
        type: DataTypes.DOUBLE,
        allowNull: false,
        field: 'total_udi',
      },
      udiValue: {
        type: DataTypes.DOUBLE,
        allowNull: false,
        field: 'udi_value',
      },
      purchasedOn: {
        type: DataTypes.DATE,
        allowNull: false,
        field: 'date_purchase',
      }
    },
    {
      sequelize,
      underscored: true,
      tableName: 'udi',
      timestamps: false,
    }
  )
}
