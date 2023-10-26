import {
  Model
} from 'sequelize';

export class ExpenseTags extends Model {
  public pk_expenses_tags: string;
  public expenseId: string;
  public tagId: string;
}
