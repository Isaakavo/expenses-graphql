import { DataTypes, Model, Op, Sequelize, col, fn } from 'sequelize';
import { CategorySettings } from './category-settings.js';
import { IncomeCategoryAllocation } from './income-category-allocation.js';
import { SubCategory } from './sub-category.js';

export class Category extends Model {
  public id!: string;
  public userId!: string | null;
  public name!: string;
  public subCategory!: SubCategory[];
  public archivedAt!: Date | null;
  public createdAt!: Date;
  public updatedAt!: Date;

  static associate() {
    this.hasMany(CategorySettings);
    this.hasMany(IncomeCategoryAllocation);
    this.hasMany(SubCategory, { as: 'subCategory', foreignKey: 'category_id' });
  }
}

export const initCategoryModel = (sequelize: Sequelize) => {
  Category.init(
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
          name: 'categories_global_name_unique',
          unique: true,
          fields: [fn('lower', col('name'))],
          where: { user_id: null },
        },
        {
          name: 'categories_user_name_unique',
          unique: true,
          fields: ['user_id', fn('lower', col('name'))],
          where: { user_id: { [Op.ne]: null } },
        },
      ],
    }
  );
};
