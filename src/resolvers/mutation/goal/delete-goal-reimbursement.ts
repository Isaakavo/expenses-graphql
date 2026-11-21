import { MutationResolvers } from '../../../generated/graphql.js';
import { GoalService } from '../../../service/goal-service.js';

export const deleteGoalReimbursement: MutationResolvers['deleteGoalReimbursement'] =
  async (_, { id }, { user: { userId }, sequelizeClient }) => {
    const service = new GoalService(userId, sequelizeClient);

    return service.deleteReimbursement(id);
  };
