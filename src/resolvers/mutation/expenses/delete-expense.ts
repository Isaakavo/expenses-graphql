import { MutationResolvers } from '../../../generated/graphql.js';
import { ExpensesService } from '../../../service/expenses-service.js';

export const deleteExpense: MutationResolvers['deleteExpense'] = async (
  _,
  { id },
  context
) => {
  const {
    user: { userId },
  } = context;
  const expenseService = new ExpensesService(userId, context.sequelizeClient);

  return expenseService.deleteExpense(id);
};
