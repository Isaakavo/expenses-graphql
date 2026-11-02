import { adaptRecurringSeries } from '../../../adapters/recurrence-adapter.js';
import { QueryResolvers } from '../../../generated/graphql.js';
import { RecurrenceService } from '../../../service/recurrence-service.js';

export const recurringSeries: QueryResolvers['recurringSeries'] = async (
  _,
  { id },
  { user: { userId }, sequelizeClient }
) => {
  const series = await new RecurrenceService(userId, sequelizeClient).getSeries(id);
  return series ? adaptRecurringSeries(series) : null;
};
