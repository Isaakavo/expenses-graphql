import { QueryResolvers } from '../../../generated/graphql.js';
import { findAllExpensesWithCards } from '../../../utils/expenses-utils.js';

export const allExpenses: QueryResolvers['allExpenses'] = async (
  _,
  __,
  context
) => {
  const {
    user: { userId },
  } = context;

  return findAllExpensesWithCards({ userId });
};
