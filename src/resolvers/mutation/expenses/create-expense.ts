import { ExpensesService } from '../../../service/expenses-service.js';
import { MutationResolvers } from '../../../generated/graphql.js';
import { adaptExpenses } from '../../../adapters/income-adapter.js';

export const createExpense: MutationResolvers['createExpense'] = async (
  _,
  { input },
  { user: { userId } }
) => {
  const expenseService = new ExpensesService(userId);
  const newExpense = await expenseService.createExpense(input);  

  return adaptExpenses(newExpense);
};
