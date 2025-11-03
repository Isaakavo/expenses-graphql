import { adaptExpensesDTOInput } from '../../../adapters/income-adapter.js';
import { QueryResolvers } from '../../../generated/graphql.js';
import { ExpensesService } from '../../../service/expenses-service.js';

export const expenseById: QueryResolvers['expenseById'] = async (_, { id }, context) => {
  const {
    user: { userId },
  } = context;

  const expensesService = new ExpensesService(userId, context.sequilizeClient);
  const expense = await expensesService.getExpenseById(id);

  return adaptExpensesDTOInput(expense);
};
