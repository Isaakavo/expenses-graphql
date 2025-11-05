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

  async getPeriodBy(date: Date, periodId: string) {
    return await this.periodRepository.getPeriodBy({date, id: periodId});
  }

  // async createPeriod(startDate: Date, endDate: Date) {
  // return this.periodRepository.createPeriod(startDate, endDate);
  // }
}
