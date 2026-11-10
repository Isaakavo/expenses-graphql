import { adaptRecurringSeries } from '../../../adapters/recurrence-adapter.js';
import { MutationResolvers } from '../../../generated/graphql.js';
import { RecurrenceService } from '../../../service/recurrence-service.js';

export const updateRecurrence: MutationResolvers['updateRecurrence'] = async (
  _,
  { input },
  { user: { userId }, sequelizeClient }
) => adaptRecurringSeries(await new RecurrenceService(userId, sequelizeClient).updateRecurrence(input));
