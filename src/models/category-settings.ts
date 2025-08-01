import { Model, DataTypes, Sequelize } from 'sequelize';
import { Category } from './category.js';

export class CategorySettings extends Model {
  public id!: string;
  public userId!: string;
  public categoryId!: string;
  public percentage!: number;
  // public periodType!: 'WEEKLY' | 'FORTNIGHTLY' | 'MONTHLY';

  static associate() {
    this.belongsTo(Category);
  }
}

export const initUserCategoryAllocationTemplateModel = (
  sequelize: Sequelize
) => {
  CategorySettings.init(
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
      // periodType: {
      //   type: DataTypes.ENUM('WEEKLY', 'FORTNIGHTLY', 'MONTHLY'),
      //   allowNull: false,
      // }
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
