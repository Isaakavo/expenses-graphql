import { Period } from 'models/periods';
import { Period as GraphqlPeriod } from '../generated/graphql.js';
import { formatInTimeZone } from 'date-fns-tz';

export const adaptPeriod = (period: Period): GraphqlPeriod => {
  return {
    id: period.id,
    userId: period.userId,
    startDate: formatInTimeZone(period.startDate,'UTC', 'dd MMMM yyyy'),
    endDate: formatInTimeZone(period.endDate,'UTC', 'dd MMMM yyyy'),
    createdAt: formatInTimeZone(period.createdAt,'UTC', 'dd MMMM'),
    updatedAt: formatInTimeZone(period.updatedAt,'UTC', 'dd MMMM'),
  };
};
