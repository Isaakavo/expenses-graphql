import { QueryResolvers } from '../../../generated/graphql.js';
import { ExpensesService } from '../../../service/expenses-service.js';

export const allExpenses: QueryResolvers['allExpenses'] = async (
  _,
  __,
  context
) => {
  const {
    user: { userId },
  } = context;

  const service = new ExpensesService();

  return service.getAllExpenses(userId);
};
