import { adaptPeriod } from '../../../adapters/period-adapter.js';
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

  const period = await periodsService.getPeriodByDate(startDate);

  return adaptPeriod(period);
};
