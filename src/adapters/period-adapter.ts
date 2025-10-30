import { Period as GraphqlPeriod } from '../generated/graphql.js';
import { formatInTimeZone } from 'date-fns-tz';
import { PeriodDTO } from '../dto/period-dto.js';

export const adaptPeriod = (period: PeriodDTO): GraphqlPeriod => {
  return {
    id: period.id,
    userId: period.userId,
    startDate: formatInTimeZone(period.startDate,'UTC', 'dd MMMM yyyy'),
    endDate: formatInTimeZone(period.endDate,'UTC', 'dd MMMM yyyy'),
    createdAt: formatInTimeZone(period.createdAt,'UTC', 'dd MMMM'),
    updatedAt: formatInTimeZone(period.updatedAt,'UTC', 'dd MMMM'),
  };
};

export const adaptPeriodDTo = (period): PeriodDTO => {  
  return {
    id: period.id,
    userId: period.userId,
    type: null,
    startDate: period.startDate,
    endDate: period.endDate,
    createdAt: period.createdAt,
    updatedAt: period.updatedAt,
  };
}
