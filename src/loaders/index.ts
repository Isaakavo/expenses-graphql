import DataLoader from 'dataloader';
import { Sequelize } from 'sequelize';
import { ExpenseDTO } from '../dto/expense-dto.js';
import { GoalService } from '../service/goal-service.js';

export interface Loaders {
  goalExpenses: DataLoader<string, ExpenseDTO[]>;
}

export const createLoaders = (
  userId: string,
  sequelizeClient: Sequelize
): Loaders => {
  const goalService = new GoalService(userId, sequelizeClient);

  return {
    goalExpenses: new DataLoader<string, ExpenseDTO[]>(
      (goalIds) => goalService.getExpensesGroupedByGoalIds(goalIds),
      { cache: false }
    ),
  };
};
