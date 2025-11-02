import {
  adaptExpensesDTOInput
} from '../../../adapters/income-adapter.js';
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

  const service = new ExpensesService(userId);

  const expenses = await service.getAllExpenses();

  return expenses.map((expense) => adaptExpensesDTOInput(expense));
};
