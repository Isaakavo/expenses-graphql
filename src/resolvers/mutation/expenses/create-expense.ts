import { adaptExpensesDTOInput } from '../../../adapters/income-adapter.js';
import { MutationResolvers } from '../../../generated/graphql.js';
import { ExpensesService } from '../../../service/expenses-service.js';

export const createExpense: MutationResolvers['createExpense'] = async (
  _,
  { input },
  { user: { userId } }
) => {
  const expenseService = new ExpensesService(userId);
  const newExpense = await expenseService.createExpense(input);

  return adaptExpensesDTOInput(newExpense);
};
