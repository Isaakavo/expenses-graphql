import { ExpenseResolvers } from '../../generated/graphql.js';

export const Expense: ExpenseResolvers = {
  goalAmount: (parent, _, { loaders }) =>
    parent.goalId ? loaders.goalAmounts.load(parent.id) : null,
  recurrence: (parent, _, { loaders }) => loaders.expenseRecurrences.load(parent.id),
};
