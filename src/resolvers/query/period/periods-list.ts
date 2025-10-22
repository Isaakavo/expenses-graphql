import { PeriodService } from '../../../service/period-service.js';
import { QueryResolvers } from '../../../generated/graphql.js';
import { adaptPeriod } from '../../../adapters/period-adapter.js';

export const periodsList: QueryResolvers['periodsList'] = async (
  _,
  __,
  context
) => {
  const {
    user: { userId },
    sequilizeClient,
  } = context;
  const periodsService = new PeriodService(userId, sequilizeClient);

  return (await periodsService.getAllPeriods()).map((period) => ({
    ...adaptPeriod(period),
  }));
};
