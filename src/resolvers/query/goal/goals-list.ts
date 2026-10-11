import { QueryResolvers } from '../../../generated/graphql.js';
import { GoalService } from '../../../service/goal-service.js';
import { adaptGoals } from '../../../adapters/goal-adapter.js';

export const goalsList: QueryResolvers['goals'] = async (
  _,
  __,
  { user: { userId }, sequelizeClient }
) => {
  const service = new GoalService(userId, sequelizeClient);

  return adaptGoals(await service.getGoals());
};
