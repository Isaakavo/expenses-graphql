import { adaptExpensesDTOInput } from '../../../adapters/income-adapter.js';
import { MutationResolvers } from '../../../generated/graphql.js';
import { ExpensesService } from '../../../service/expenses-service.js';

export const createSplitExpense: MutationResolvers['createSplitExpense'] = async (
  _,
  { input, reimbursable },
  { user: { userId }, sequelizeClient }
) => {
  const expenseService = new ExpensesService(userId, sequelizeClient);
  const created = await expenseService.createSplitExpense(input, reimbursable);

  return created.map(adaptExpensesDTOInput);
};
