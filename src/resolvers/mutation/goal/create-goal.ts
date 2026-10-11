import { MutationResolvers } from '../../../generated/graphql.js';
import { GoalService } from '../../../service/goal-service.js';
import { adaptGoal } from '../../../adapters/goal-adapter.js';

export const createGoal: MutationResolvers['createGoal'] = async (
  _,
  { input },
  { user: { userId }, sequelizeClient }
) => {
  const service = new GoalService(userId, sequelizeClient);

  return adaptGoal(await service.createGoal(input));
};
