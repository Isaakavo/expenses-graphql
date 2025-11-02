import { CreateOptions, Op, Sequelize, WhereOptions } from 'sequelize';
import { logger } from '../logger.js';
import { Period } from '../models/periods.js';

export class PeriodRepository {
  userId: string;
  sequelize: Sequelize;
  FORTNIGHTLY_NUMBER_OF_DAYS = 13;

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

  async getPeriodBy(date: Date, periodId: string) {
    const where: WhereOptions = {
      userId: this.userId,
    };

    if (periodId) {
      where['id'] = periodId;
    }
    if (date) {
      where['startDate'] = { [Op.lte]: date };
      where['endDate'] = { [Op.gte]: date };
    }

    return Period.findOne({
      where,
    });
  }

  async createPeriod(startDate: Date, options?: CreateOptions) {
    const endDate = new Date(startDate);
    // TODO create table for user settings where the period type can be stored
    // and retrieved dynamically based on user preferences.
    // For now, we will use a hardcoded value for the period type.
    // Default value for now, this value should come from user settings or input
    const periodType: 'WEEKLY' | 'FORTNIGHTLY' | 'MONTHLY' = 'FORTNIGHTLY';

    switch (periodType) {
      // case 'WEEKLY':
      //   endDate.setDate(endDate.getDate() + 7);
      //   break;
      case 'FORTNIGHTLY':
        endDate.setDate(endDate.getDate() + this.FORTNIGHTLY_NUMBER_OF_DAYS);
        logger.info(
          `Creating fortnightly period from ${startDate.toISOString()} to ${endDate.toISOString()}`
        );
        break;
      // case 'MONTHLY':
      //   endDate.setMonth(endDate.getMonth() + 1);
      //   break;
      default:
        throw new Error('Invalid period type');
    }

    const period = await Period.findOne({
      where: {
        userId: this.userId,
        type: periodType,
        startDate: { [Op.lte]: startDate },
        endDate: { [Op.gte]: startDate },
      },
    });

    if (period) {
      logger.info(
        `Found existing period: ${period.id} ${startDate} to ${endDate}`
      );
      if (startDate > period.startDate) {
        await period.update({ startDate, endDate });
      }
      return period.reload();
    }

    const result = await Period.create(
      {
        userId: this.userId,
        type: periodType,
        startDate,
        endDate,
      },
      options
    );

    logger.info(
      `Period created: ${
        result.id
      } - ${startDate.toISOString()} to ${endDate.toISOString()}`
    );

    return result;
  }
}
