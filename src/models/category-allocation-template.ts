import { Model, DataTypes, Sequelize } from 'sequelize';

export class UserCategoryAllocationTemplate extends Model {}

// Config table from where the income categoru allocation will take the % of the category
export const initUserCategoryAllocationTemplateModel = (
  sequelize: Sequelize
) => {
  UserCategoryAllocationTemplate.init(
    {
      id: {
        type: DataTypes.UUID,
        defaultValue: DataTypes.UUIDV4,
        primaryKey: true,
      },
      percentage: {
        type: DataTypes.FLOAT,
        allowNull: false,
        validate: {
          min: 0,
          max: 1,
        },
      },
    },
    {
      sequelize,
      modelName: 'UserCategoryAllocationTemplate',
      indexes: [
        {
          unique: true,
          fields: ['UserId', 'CategoryId'], // 🔐 Previene duplicados
        },
      ],
    }
  );
};
