import { DataTypes, Model, Sequelize } from 'sequelize';

/**
 * Represents the fee record for an investment, including bonuses and commissions.
 */
export class InvestmentFeeRecord extends Model {
  public id!: number;
  public userId!: string;
  public monthlyBonus!: number;
  public udiCommission!: number;
  public yearlyBonus!: number;
  public monthlyTotalBonus!: number;
  public dateAdded!: Date;
}

/**
 * Initializes the InvestmentFeeRecord model with its schema and associations.
 * @param sequelize The Sequelize instance.
 */
export function initInvestmentFeeRecordModel(sequelize: Sequelize) {
  InvestmentFeeRecord.init(
    {
      id: {
        type: DataTypes.INTEGER,
        autoIncrement: true,
        primaryKey: true,
      },
      userId: {
        type: DataTypes.UUID,
        allowNull: false,
        field: 'user_id',
      },
      monthlyBonus: {
        type: DataTypes.DOUBLE,
        allowNull: false,
        field: 'monthly_bonus',
      },
      udiCommission: {
        type: DataTypes.DOUBLE,
        allowNull: false,
        field: 'udi_commission',
      },
      yearlyBonus: {
        type: DataTypes.DOUBLE,
        allowNull: false,
        field: 'yarly_bonus',
      },
      monthlyTotalBonus: {
        type: DataTypes.DOUBLE,
        allowNull: false,
        field: 'monthly_total_bonus',
      },
      dateAdded: {
        type: DataTypes.DATE,
        allowNull: false,
        field: 'date_added',
      }
    },
    {
      sequelize,
      underscored: true,
      tableName: 'udi_commissions',
      timestamps: false, // Assuming you don't have createdAt/updatedAt based on the schema
    }
  );
}
