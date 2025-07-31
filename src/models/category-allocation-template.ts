import { Model, DataTypes, Sequelize } from 'sequelize';

export class UserCategoryAllocationTemplate extends Model {}

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
      userId: {
        type: DataTypes.UUID,
        allowNull: false,
        field: 'user_id'
      },
      categoryId: {
        type: DataTypes.UUID,
        allowNull: false,
        field: 'category_id',
        references: {
          model: 'categories',
          key: 'id',
        },
      },
      percentage: {
        type: DataTypes.DECIMAL(5, 2),
        allowNull: false,
        validate: {
          min: 0,
          max: 100,
        },
      },
    },
    {
      sequelize,
      underscored: true,
      indexes: [
        {
          unique: true,
          fields: ['user_id', 'category_id'],
        },
      ],
    }
  );
};
