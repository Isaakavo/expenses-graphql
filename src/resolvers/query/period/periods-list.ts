import { PeriodService } from '../../../service/period-service.js';
import { QueryResolvers } from '../../../generated/graphql.js';

export const periodsList: QueryResolvers['periodsList'] = async (
  _,
  __,
  context
) => {
  const {
    user: { userId },
    sequilizeClient,
  } = context;
  const periodsService = new PeriodService(userId, sequilizeClient)  

  return periodsService.getAllPeriods();
};
