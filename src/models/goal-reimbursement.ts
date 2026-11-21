import { DataTypes, Model, Sequelize } from 'sequelize';

export class GoalReimbursement extends Model {
  public id!: string;
  public userId!: string;
  public goalId!: string;
  public amount!: string;
  public receivedOn!: string;
  public comment!: string | null;
  public createdAt!: Date;
  public updatedAt!: Date;
}

export const initGoalReimbursementModel = (sequelize: Sequelize) => {
  GoalReimbursement.init(
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
      goalId: {
        type: DataTypes.UUID,
        allowNull: false,
        field: 'goal_id',
      },
      amount: {
        type: DataTypes.DECIMAL(12, 2),
        allowNull: false,
      },
      receivedOn: {
        type: DataTypes.DATEONLY,
        allowNull: false,
        field: 'received_on',
      },
      comment: {
        type: DataTypes.STRING(255),
        allowNull: true,
      },
    },
    {
      sequelize,
      tableName: 'goal_reimbursements',
      underscored: true,
      indexes: [{ name: 'goal_reimbursements_goal_id_idx', fields: ['goal_id'] }],
    }
  );
};
