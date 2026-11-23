import { MutationResolvers } from '../../../generated/graphql.js';
import { GoalService } from '../../../service/goal-service.js';
import { adaptGoalReimbursement } from '../../../adapters/goal-adapter.js';

export const updateGoalReimbursement: MutationResolvers['updateGoalReimbursement'] =
  async (_, { input }, { user: { userId }, sequelizeClient }) => {
    const service = new GoalService(userId, sequelizeClient);

    return adaptGoalReimbursement(await service.updateReimbursement(input));
  };
