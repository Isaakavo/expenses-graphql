import { DataTypes, Model, Sequelize } from 'sequelize';

export class Category extends Model {
  public id!: string;
  public userId!: string | null;
  public name!: string;
  public createdAt!: Date;
  public updatedAt!: Date;
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
