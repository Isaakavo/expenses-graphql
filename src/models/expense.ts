import {
  ForeignKey,
  Model
} from 'sequelize';
import { Income } from './income';
//TODO include a column for check (if a paymet was already done and when it was done)
export class Expense extends Model {
  public id!: number;
  public userId!: string;
  public concept!: string;
  public total!: number;
  public comments!: string;
  public payBefore!: Date;
  public createdAt!: Date;
  public updatedAt!: Date;
  declare incomeId: ForeignKey<Income['id']>;
}
