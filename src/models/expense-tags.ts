import {
  Model
} from 'sequelize';

export class ExpenseTags extends Model {
  public pk_expenses_tags: number;
  public expenseId: number;
  public tagId: number;
}
