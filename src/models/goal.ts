import { DataTypes, Model, Sequelize } from 'sequelize';

export class Goal extends Model {
  public id!: string;
  public userId!: string;
  public name!: string;
  public targetAmount!: number;
  // DATEONLY columns are returned as 'yyyy-MM-dd' strings
  public startDate!: string;
  public endDate!: string | null;
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
      targetAmount: {
        type: DataTypes.DECIMAL(12, 2),
        allowNull: false,
        field: 'target_amount',
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
    },
    {
      sequelize,
      tableName: 'goals',
      underscored: true,
      indexes: [{ name: 'goals_user_id_idx', fields: ['user_id'] }],
    }
  );
};
