import { Model } from 'sequelize';

export class Income extends Model {
  public id!: string;
  public total!: number;
  public paymentDate!: Date;
  public comment!: string;
  public userId!: string;
  public createdAt!: Date;
  public updatedAt!: Date;
}
