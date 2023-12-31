import {
  ForeignKey,
  Model
} from 'sequelize';
import { Card } from './card';
//TODO include a column for check (if a paymet was already done and when it was done)
export class Expense extends Model {
  public id!: string;
  public userId!: string;
  public concept!: string;
  public total!: number;
  public comments!: string;
  public payBefore!: Date;
  public createdAt!: Date;
  public updatedAt!: Date;
  public category!: string;
  declare cardId: ForeignKey<Card['id']>;
}
