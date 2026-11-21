import { DataTypes, Model, Sequelize } from 'sequelize';
import { CurrencyCode, GoalKind } from '../generated/graphql.js';

export class Goal extends Model {
  public id!: string;
  public userId!: string;
  public name!: string;
  public kind!: GoalKind;
  public targetAmount!: number | null;
  public currency!: CurrencyCode;
  // DATEONLY columns are returned as 'yyyy-MM-dd' strings
  public startDate!: string;
  public endDate!: string | null;
  public fundId!: string | null;
  public defaultCardId!: string | null;
  public createdAt!: Date;
  public updatedAt!: Date;
}

export const initGoalModel = (sequelize: Sequelize) => {
  Goal.init(
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
      kind: {
        type: DataTypes.STRING(16),
        allowNull: false,
        defaultValue: GoalKind.SAVINGS,
      },
      targetAmount: {
        type: DataTypes.DECIMAL(12, 2),
        allowNull: true,
        field: 'target_amount',
      },
      currency: {
        type: DataTypes.CHAR(3),
        allowNull: false,
        defaultValue: CurrencyCode.USD,
      },
      startDate: {
        type: DataTypes.DATEONLY,
        allowNull: false,
        field: 'start_date',
      },
      endDate: {
        type: DataTypes.DATEONLY,
        allowNull: true,
        field: 'end_date',
      },
      fundId: {
        type: DataTypes.UUID,
        allowNull: true,
        field: 'fund_id',
      },
      defaultCardId: {
        type: DataTypes.UUID,
        allowNull: true,
        field: 'default_card_id',
      },
    },
    {
      sequelize,
      tableName: 'goals',
      underscored: true,
      indexes: [{ name: 'goals_user_id_idx', fields: ['user_id'] }],
    }
  );
};
