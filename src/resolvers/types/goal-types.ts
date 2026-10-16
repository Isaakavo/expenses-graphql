import { ExpenseResolvers, GoalResolvers } from '../../generated/graphql.js';
import { adaptExpensesDTOInput } from '../../adapters/income-adapter.js';

export const Goal: GoalResolvers = {
  expenses: async (parent, _, { loaders }) => {
    const expenses = await loaders.goalExpenses.load(parent.id);

    return expenses.map((expense) => adaptExpensesDTOInput(expense));
  },
};

export const Expense: ExpenseResolvers = {
  goalAmount: (parent, _, { loaders }) =>
    parent.goalId ? loaders.goalAmounts.load(parent.id) : null,
};
