import { MutationResolvers } from '../../../generated/graphql.js';
import { RecurrenceService } from '../../../service/recurrence-service.js';

export const deleteRecurringExpense: MutationResolvers['deleteRecurringExpense'] = async (
  _,
  { id, scope },
  { user: { userId }, sequelizeClient }
) => new RecurrenceService(userId, sequelizeClient).deleteExpense(id, scope);
