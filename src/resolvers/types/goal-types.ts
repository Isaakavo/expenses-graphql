import { GoalResolvers } from '../../generated/graphql.js';
import { GoalService } from '../../service/goal-service.js';
import { adaptExpensesDTOInput } from '../../adapters/income-adapter.js';

export const Goal: GoalResolvers = {
  expenses: async (parent, _, { user: { userId }, sequelizeClient }) => {
    const service = new GoalService(userId, sequelizeClient);
    const expenses = await service.getGoalExpenses(parent.id);

    return expenses.map((expense) => adaptExpensesDTOInput(expense));
  },
};
