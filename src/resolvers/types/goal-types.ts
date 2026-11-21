import { GoalResolvers } from '../../generated/graphql.js';
import { adaptExpensesDTOInput } from '../../adapters/income-adapter.js';
import { adaptGoalReimbursement } from '../../adapters/goal-adapter.js';

export const Goal: GoalResolvers = {
  expenses: async (parent, _, { loaders }) => {
    const expenses = await loaders.goalExpenses.load(parent.id);

    return expenses.map((expense) => adaptExpensesDTOInput(expense));
  },
  reimbursements: async (parent, _, { loaders }) => {
    const reimbursements = await loaders.goalReimbursements.load(parent.id);

    return reimbursements.map(adaptGoalReimbursement);
  },
};
