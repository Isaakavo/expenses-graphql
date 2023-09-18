import { sequilize } from '../database/client.js';
import {
  DataTypes,
  InferAttributes,
  InferCreationAttributes,
  Model,
} from 'sequelize';

interface Tag
  extends Model<InferAttributes<Tag>, InferCreationAttributes<Tag>> {
  id: number;
  name: string;
  createdAt: Date;
  updatedAt: Date;
}

export const Tag = sequilize.define<Tag>('tag', {
  id: {
    type: DataTypes.BIGINT,
    primaryKey: true,
    autoIncrement: true,
  },
  name: {
    type: DataTypes.STRING,
    allowNull: false,
    unique: true,
  },
  createdAt: {
    type: DataTypes.DATE,
    allowNull: false,
  },
  updatedAt: {
    type: DataTypes.DATE,
  },
});
