import { QueryResolvers } from '../.../../../../generated/graphql.js';
import { PeriodService } from '../.../../../../service/period-service.js';

export const period: QueryResolvers['period'] = async (
  _,
  { input: { startDate } },
  context
) => {
  const {
    user: { userId },
    sequilizeClient,
  } = context;
  const periodsService = new PeriodService(userId, sequilizeClient);

  return periodsService.getPeriodByDate(startDate);
};
