import { QueryResolvers } from '../../../generated/graphql.js';
import { GoalService } from '../../../service/goal-service.js';
import { adaptGoal } from '../../../adapters/goal-adapter.js';

export const goalById: QueryResolvers['goal'] = async (
  _,
  { id },
  { user: { userId }, sequelizeClient }
) => {
  const service = new GoalService(userId, sequelizeClient);
  const goal = await service.getGoalById(id);

  return goal ? adaptGoal(goal) : null;
};
