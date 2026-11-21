import { QueryResolvers } from '../../../generated/graphql.js';
import { GoalService } from '../../../service/goal-service.js';
import { adaptSavingsFund } from '../../../adapters/goal-adapter.js';

export const savingsFunds: QueryResolvers['savingsFunds'] = async (
  _,
  __,
  { user: { userId }, sequelizeClient }
) => {
  const service = new GoalService(userId, sequelizeClient);

  return (await service.getSavingsFunds()).map(adaptSavingsFund);
};
