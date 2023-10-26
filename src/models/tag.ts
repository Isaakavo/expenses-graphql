import {
  Model
} from 'sequelize';

export class Tag extends Model {
  public id!: string;
  public name!: string;
  public createdAt!: Date;
  public updatedAt!: Date;
}
