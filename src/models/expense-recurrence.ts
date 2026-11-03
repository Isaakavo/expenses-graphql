import { DataTypes, Model, Sequelize } from 'sequelize';
import { FixedExpenseFrequency } from '../generated/graphql.js';

export class ExpenseRecurrence extends Model {
  public id!: string;
  public userId!: string;
  public frequency!: FixedExpenseFrequency;
  public createdAt!: Date;
  public updatedAt!: Date;
}

export const initExpenseRecurrenceModel = (sequelize: Sequelize) => {
  ExpenseRecurrence.init(
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
      frequency: {
        type: DataTypes.STRING(10),
        allowNull: false,
      },
    },
    {
      sequelize,
      tableName: 'expense_recurrences',
      underscored: true,
      indexes: [{ name: 'expense_recurrences_user_id_idx', fields: ['user_id'] }],
    }
  );
};
