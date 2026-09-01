import { Period as GraphqlPeriod } from '../generated/graphql.js';
import { formatInTimeZone } from 'date-fns-tz';
import { PeriodDTO } from '../dto';
import { logger } from '../logger.js';

type PeriodLike = {
  id: string;
  userId: string;
  startDate: Date | string;
  endDate: Date | string;
  createdAt?: Date | string;
  updatedAt?: Date | string;
};

export const adaptPeriod = (period: PeriodLike): GraphqlPeriod => {
  return {
    id: period.id,
    userId: period.userId,
    startDate: formatInTimeZone(period.startDate, 'UTC', 'dd MMMM yyyy'),
    endDate: formatInTimeZone(period.endDate, 'UTC', 'dd MMMM yyyy'),
    createdAt: formatInTimeZone(period.createdAt, 'UTC', 'dd MMMM'),
    updatedAt: formatInTimeZone(period.updatedAt, 'UTC', 'dd MMMM'),
  };
};

export const adaptPeriodDTO = (period): PeriodDTO | null => {
  try {
    return {
      id: period.id,
      userId: period.userId,
      type: null,
      startDate: period.startDate,
      endDate: period.endDate,
      createdAt: period.createdAt,
      updatedAt: period.updatedAt,
    };
  } catch (error) {
    logger.error('Error adapting Period to PeriodDTO: ' + error.message);
    return null;
  }
};
