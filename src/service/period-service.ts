import { Sequelize } from 'sequelize';
import { PeriodRepository } from '../repository/period-repository.js';

export class PeriodService {
  private periodRepository: PeriodRepository;
  userId: string;

  constructor(userId: string, sequelize: Sequelize) {
    this.userId = userId;
    this.periodRepository = new PeriodRepository(userId, sequelize);
  }

  async getAllPeriods() {
    return this.periodRepository.getAllPeriods();
  }

  async getPeriodByDate(date: Date) {
    return this.periodRepository.getPeriodByDay(date);
  }

  async createPeriod(startDate: Date, endDate: Date) {
    // return this.periodRepository.createPeriod(startDate, endDate);
  }
}
