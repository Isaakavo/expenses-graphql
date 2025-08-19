import { PeriodRepository } from '../repository/period-repository.js';

export class PeriodService {
  private periodRepository: PeriodRepository;
  userId: string;

  constructor(userId: string) {
    this.userId = userId;
    this.periodRepository = new PeriodRepository(userId);
  }

  async getAllPeriods() {
    return this.periodRepository.getAllPeriods();
  }

  async createPeriod(startDate: Date, endDate: Date) {
    // return this.periodRepository.createPeriod(startDate, endDate);
  }
}
