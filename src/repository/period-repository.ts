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
    try {
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

      logger.info(`Found period ${period.id}`);

      return adaptPeriodDTO(period);
    } catch (error) {
      logger.error(error.message);
    }
  }

  async createPeriod(
    startDate: Date,
    options: { transaction?: Transaction } = {}
  ) {
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
      if (startDate > existing.startDate) {
        await existing.update(
          { startDate, endDate },
          { transaction: options.transaction }
        );
      }
      return existing.reload({ transaction: options.transaction });
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
      chainStart = new Date(latestBefore.endDate);
      chainStart.setDate(chainStart.getDate() + 1);
    } else {
      chainStart = startDate;
    }

    let result: Period;
    let currentStart = chainStart;

    while (currentStart <= startDate) {
      const currentEnd = new Date(currentStart);
      currentEnd.setDate(currentEnd.getDate() + FORTNIGHTLY_NUMBER_OF_DAYS);

      result = await Period.create(
        {
          userId: this.userId,
          type: periodType,
          startDate: currentStart,
          endDate: currentEnd,
        },
        { transaction: options.transaction }
      );

      logger.info(
        `Period created: ${result.id} - ${currentStart.toISOString()} to ${currentEnd.toISOString()}`
      );

      currentStart = new Date(currentEnd);
      currentStart.setDate(currentStart.getDate() + 1);
    }

    return result;
  }
}
