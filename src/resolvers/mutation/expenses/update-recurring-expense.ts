import { adaptExpensesDTOInput } from '../../../adapters/income-adapter.js';
import { MutationResolvers } from '../../../generated/graphql.js';
import { RecurrenceService } from '../../../service/recurrence-service.js';
import { toExpenseUpdate } from './update-expense.js';

export const updateRecurringExpense: MutationResolvers['updateRecurringExpense'] = async (
  _,
  { input, scope },
  { user: { userId }, sequelizeClient }
) => {
  const recurrenceService = new RecurrenceService(userId, sequelizeClient);
  const updated = await recurrenceService.updateExpense(input.id, toExpenseUpdate(input), scope);

  return updated.map((expense) => adaptExpensesDTOInput(expense));
};
