import { MutationResolvers } from '../../../generated/graphql.js';
import { GoalService } from '../../../service/goal-service.js';

export const deleteGoal: MutationResolvers['deleteGoal'] = async (
  _,
  { id },
  { user: { userId }, sequelizeClient }
) => {
  const service = new GoalService(userId, sequelizeClient);

  return service.deleteGoal(id);
};
