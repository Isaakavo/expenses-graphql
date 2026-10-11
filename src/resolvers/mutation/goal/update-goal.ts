import { MutationResolvers } from '../../../generated/graphql.js';
import { GoalService } from '../../../service/goal-service.js';
import { adaptGoal } from '../../../adapters/goal-adapter.js';

export const updateGoal: MutationResolvers['updateGoal'] = async (
  _,
  { input },
  { user: { userId }, sequelizeClient }
) => {
  const service = new GoalService(userId, sequelizeClient);

  return adaptGoal(await service.updateGoal(input));
};
