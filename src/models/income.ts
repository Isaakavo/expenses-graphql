import {
  Association,
  Model, NonAttribute
} from 'sequelize';
import { Expense } from './expense';

export class Income extends Model {
  public id!: number;
  public total!: number;
  public paymentDate!: Date;
  public comment!: string;
  public userId!: string;
  public createdAt!: Date;
  public updatedAt!: Date;

  declare expenses?: NonAttribute<Expense[]>

  declare static associations: {
    expenses: Association<Income, Expense>
  }
}
