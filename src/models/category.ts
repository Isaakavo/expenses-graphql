import { DataTypes, Model, Sequelize } from 'sequelize';
import { CategorySettings } from './category-settings.js';
import { IncomeCategoryAllocation } from './income-category-allocation.js';
import { SubCategory } from './sub-category.js';

export class Category extends Model {
  public id!: string;
  public userId!: string | null;
  public name!: string;
  public createdAt!: Date;
  public updatedAt!: Date;

  static associate() {
    this.hasMany(CategorySettings);
    this.hasMany(IncomeCategoryAllocation);
    this.hasMany(SubCategory);
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
        unique: true,
        allowNull: false,
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
    { sequelize, underscored: true }
  );
};
