import { Model, Sequelize, DataTypes } from 'sequelize';

export class SubCategory extends Model {
  public id!: string;
  public userId!: string | null;
  public name!: string;
  public categoryId!: string;
  public createdAt!: Date;
  public updatedAt!: Date;
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
        field: 'user_id'
      },
      name: {
        type: DataTypes.STRING,
        unique: true,
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
      createdAt: {
        type: DataTypes.DATE,
        allowNull: false,
        field: 'created_at'
      },
      updatedAt: {
        type: DataTypes.DATE,
        field: 'updated_at'
      },
    },
    { sequelize, underscored: true }
  );
};
