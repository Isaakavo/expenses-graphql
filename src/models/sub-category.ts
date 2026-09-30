import { Category } from './category.js';
import { DataTypes, Model, Op, Sequelize, col, fn } from 'sequelize';

export class SubCategory extends Model {
  public id!: string;
  public userId!: string | null;
  public name!: string;
  public categoryId!: string;
  public archivedAt!: Date | null;
  public createdAt!: Date;
  public updatedAt!: Date;

  static associate() {
    this.belongsTo(Category, { foreignKey: 'categoryId', as: 'category' });
  }
}

export const initSubCategoryModel = (sequelize: Sequelize) => {
  SubCategory.init(
    {
      id: {
        type: DataTypes.UUID,
        defaultValue: DataTypes.UUIDV4,
        primaryKey: true,
      },
      userId: {
        type: DataTypes.UUID,
        allowNull: true,
        field: 'user_id',
      },
      name: {
        type: DataTypes.STRING,
        allowNull: false,
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
      archivedAt: {
        type: DataTypes.DATE,
        allowNull: true,
        field: 'archived_at',
      },
      createdAt: {
        type: DataTypes.DATE,
        allowNull: false,
        field: 'created_at',
      },
      updatedAt: {
        type: DataTypes.DATE,
        field: 'updated_at',
      },
    },
    {
      sequelize,
      underscored: true,
      // Keep in sync with migrations/20260930000000-category-archive-and-scoped-uniqueness.cjs
      // (same names, so sync() does not try to re-create them).
      indexes: [
        {
          name: 'sub_categories_global_name_unique',
          unique: true,
          fields: ['category_id', fn('lower', col('name'))],
          where: { user_id: null },
        },
        {
          name: 'sub_categories_user_name_unique',
          unique: true,
          fields: ['category_id', 'user_id', fn('lower', col('name'))],
          where: { user_id: { [Op.ne]: null } },
        },
      ],
    }
  );
};
