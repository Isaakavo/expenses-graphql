import {InvestmentRepository} from '../repository/investment-repository.js';
import {Sequelize} from 'sequelize';

export class InvestmentService {
  private investmentRepository: InvestmentRepository;
  userId: string;
  sequelize: Sequelize;

  constructor(userId: string, sequelize: Sequelize) {
    this.userId = userId;
    this.sequelize = sequelize;
    this.investmentRepository = new InvestmentRepository(userId, sequelize);
  }

  async getAllInvestmentRecords() {
    return this.investmentRepository.getAllInvestmentRecords();
  }
}