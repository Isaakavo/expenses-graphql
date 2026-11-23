import { QueryResolvers } from '../../../generated/graphql.js';
import { GoalService } from '../../../service/goal-service.js';

export const savingsFunds: QueryResolvers['savingsFunds'] = async (
  _,
  __,
  { user: { userId }, sequelizeClient }
) => new GoalService(userId, sequelizeClient).getSavingsFunds();
