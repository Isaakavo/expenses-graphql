import { CreateOptions } from 'sequelize';
import { Period } from '../models/periods.js';

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

  async createWeeklyPeriod(
    startDate: Date,
    period: Partial<Period>,
    options?: CreateOptions
  ) {
    const endDate = new Date(startDate);
    endDate.setDate(endDate.getDate() + 7);

    console.log(`Creating weekly period from ${startDate} to ${endDate}`);

    return Period.create(
      {
        userId: this.userId,
        type: period.type,
        startDate,
        endDate,
      },
      options
    );
  }
}
