import { adaptPeriod } from '../../../adapters/period-adapter.js';
import { QueryResolvers } from '../.../../../../generated/graphql.js';
import { PeriodService } from '../.../../../../service/period-service.js';

export const period: QueryResolvers['period'] = async (
  _,
  { input: { startDate, periodId } },
  context
) => {
  const {
    user: { userId },
    sequelizeClient,
  } = context;
  const periodsService = new PeriodService(userId, sequelizeClient);

  const period = await periodsService.getPeriodBy(startDate, periodId);

  return adaptPeriod(period);
};
