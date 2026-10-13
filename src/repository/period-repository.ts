import { startOfDay } from 'date-fns';
import {
  Op,
  Sequelize,
  Transaction,
  WhereOptions,
} from 'sequelize';
import { logger } from '../logger.js';
import { Period } from '../models/periods.js';
import { adaptPeriodDTO } from '../adapters/period-adapter.js';

export type PeriodInputs = {
  date?: Date;
  id?: string;
};

export const FORTNIGHTLY_NUMBER_OF_DAYS = 13;

export class PeriodRepository {
  userId: string;
  sequelize: Sequelize;

  constructor(userId: string, sequelize: Sequelize) {
    this.userId = userId;
    this.sequelize = sequelize;
  }

  async getAllPeriods() {
    return Period.findAll({
      where: {
        userId: this.userId,
      },
      order: [['startDate', 'DESC']],
    });
  }

  async getPeriodBy(
    input: PeriodInputs,
    options: { transaction?: Transaction } = {}
  ) {
    const { date, id } = input;
    const where: WhereOptions = {
      userId: this.userId,
    };

    if (id) {
      where['id'] = id;
    }
    if (date) {
      where['startDate'] = { [Op.lte]: date };
      where['endDate'] = { [Op.gte]: date };
    }

    const period = await Period.findOne({
      where,
      transaction: options.transaction,
    });

    if (!period) {
      logger.info('No period found for the given input');
      return null;
    }

    logger.info(`Found period ${period.id}`);
    return adaptPeriodDTO(period);
  }

  async createPeriod(
    startDate: Date,
    options: { transaction?: Transaction } = {}
  ) {
    startDate = startOfDay(startDate);
    const endDate = new Date(startDate);
    const periodType: 'WEEKLY' | 'FORTNIGHTLY' | 'MONTHLY' = 'FORTNIGHTLY';

    switch (periodType) {
    case 'FORTNIGHTLY':
      endDate.setDate(endDate.getDate() + FORTNIGHTLY_NUMBER_OF_DAYS);
      break;
    default:
      throw new Error('Invalid period type');
    }

    const existing = await Period.findOne({
      where: {
        userId: this.userId,
        type: periodType,
        startDate: { [Op.lte]: startDate },
        endDate: { [Op.gte]: startDate },
      },
      transaction: options.transaction,
    });

    if (existing) {
      logger.info(
        `Found existing period: ${existing.id} ${startDate} to ${endDate}`
      );
      return existing;
    }

    const latestBefore = await Period.findOne({
      where: {
        userId: this.userId,
        type: periodType,
        endDate: { [Op.lt]: startDate },
      },
      order: [['endDate', 'DESC']],
      transaction: options.transaction,
    });

    let chainStart: Date;
    if (latestBefore) {
      chainStart = startOfDay(new Date(latestBefore.endDate));
      chainStart.setDate(chainStart.getDate() + 1);
    } else {
      chainStart = startDate;
    }

    let result: Period;
    let currentStart = chainStart;

    while (currentStart <= startDate) {
      const currentEnd = new Date(currentStart);
      currentEnd.setDate(currentEnd.getDate() + FORTNIGHTLY_NUMBER_OF_DAYS);

      const overlapping = await Period.findOne({
        where: {
          userId: this.userId,
          type: periodType,
          startDate: { [Op.lte]: currentEnd },
          endDate: { [Op.gte]: currentStart },
        },
        transaction: options.transaction,
      });

      // A period that starts after currentStart must not be reused
      if (overlapping && new Date(overlapping.startDate) <= currentStart) {
        result = overlapping;
        logger.info(`Found overlapping period: ${overlapping.id}`);
      } else {
        const newEnd = overlapping
          ? startOfDay(new Date(overlapping.startDate))
          : currentEnd;
        if (overlapping) {
          newEnd.setDate(newEnd.getDate() - 1);
        }
        result = await Period.create(
          {
            userId: this.userId,
            type: periodType,
            startDate: currentStart,
            endDate: newEnd,
          },
          { transaction: options.transaction }
        );

        logger.info(
          `Period created: ${result.id} - ${currentStart.toISOString()} to ${newEnd.toISOString()}`
        );
      }

      currentStart = startOfDay(new Date(result.endDate));
      currentStart.setDate(currentStart.getDate() + 1);
    }

    return result;
  }
}
