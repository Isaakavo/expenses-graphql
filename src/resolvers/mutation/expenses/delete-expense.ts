import { MutationResolvers } from '../../../generated/graphql.js';
import { logger } from '../../../logger.js';
import { ExpensesService } from '../../../service/expenses-service.js';

export const deleteExpense: MutationResolvers['deleteExpense'] = async (
  _,
  { id },
  context
) => {
  try {
    const {
      user: { userId },
    } = context;
    const expenseService = new ExpensesService(userId, context.sequilizeClient);

    return expenseService.deleteExpense(id);
  } catch (error) {
    logger.error(error);
    return error;
  }
};
