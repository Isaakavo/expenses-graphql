import { Model } from 'sequelize';
//TODO include a column for check (if a paymet was already done and when it was done)
export class Category extends Model {
  public id!: string;
  public name!: string;
  public createdAt!: Date;
  public updatedAt!: Date;
}
