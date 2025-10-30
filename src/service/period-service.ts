import { Sequelize } from 'sequelize';
import { PeriodRepository } from '../repository/period-repository.js';
import { adaptPeriodDTo } from '../adapters/period-adapter.js';

export class PeriodService {
  private periodRepository: PeriodRepository;
  userId: string;

  constructor(userId: string, sequelize: Sequelize) {
    this.userId = userId;
    this.periodRepository = new PeriodRepository(userId, sequelize);
  }

  async getAllPeriods() {
    return (await this.periodRepository.getAllPeriods()).map((period) =>
      adaptPeriodDTo(period)
    );
  }

  async getPeriodByDate(date: Date) {
    const result = await this.periodRepository.getPeriodByDay(date);
    return adaptPeriodDTo(result);
  }

  // async createPeriod(startDate: Date, endDate: Date) {
  // return this.periodRepository.createPeriod(startDate, endDate);
  // }
}
