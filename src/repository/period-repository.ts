import { CreateOptions, Op } from 'sequelize';
import { Period } from '../models/periods.js';
import { logger } from '../logger.js';

export class PeriodRepository {
  userId: string;

  constructor(userId: string) {
    this.userId = userId;
  }

  async getAllPeriods() {
    return Period.findAll({
      where: {
        userId: this.userId,
      },
      order: [['startDate', 'DESC']],
    });
  }

  async createPeriod(startDate: Date, options?: CreateOptions) {
    const endDate = new Date(startDate);
    // Default value for now, this value should come from user settings or input
    const periodType: 'WEEKLY' | 'FORTNIGHTLY' | 'MONTHLY' = 'FORTNIGHTLY';

    switch (periodType) {
    // case 'WEEKLY':
    //   endDate.setDate(endDate.getDate() + 7);
    //   break;
    case 'FORTNIGHTLY':
      endDate.setDate(endDate.getDate() + 15);
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
      logger.info(`Found existing period: ${period.id} ${startDate} to ${endDate}`);
      return period;
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

    logger.info(`Period created: ${result.id} - ${startDate} to ${endDate}`);

    return result;
  }
}
