import DataLoader from 'dataloader';
import { Sequelize } from 'sequelize';
import { ExpenseDTO } from '../dto/expense-dto.js';
import { ExpenseRecurrence } from '../generated/graphql.js';
import { GoalService } from '../service/goal-service.js';
import { RecurrenceService } from '../service/recurrence-service.js';

export interface Loaders {
  goalExpenses: DataLoader<string, ExpenseDTO[]>;
  goalAmounts: DataLoader<string, string | null>;
  expenseRecurrences: DataLoader<string, ExpenseRecurrence | null>;
}

export const createLoaders = (
  userId: string,
  sequelizeClient: Sequelize
): Loaders => {
  const goalService = new GoalService(userId, sequelizeClient);
  const recurrenceService = new RecurrenceService(userId, sequelizeClient);

  return {
    goalExpenses: new DataLoader<string, ExpenseDTO[]>(
      (goalIds) => goalService.getExpensesGroupedByGoalIds(goalIds),
      { cache: false }
    ),
    goalAmounts: new DataLoader<string, string | null>((expenseIds) =>
      goalService.getGoalAmountsByExpenseIds(expenseIds)
    ),
    expenseRecurrences: new DataLoader<string, ExpenseRecurrence | null>(
      (expenseIds) => recurrenceService.getPositions(expenseIds),
      { cache: false }
    ),
  };
};
