import {InvestmentRecord} from '../models/investment-record.js';
import {Sequelize} from 'sequelize';
import {adaptInvestmentDTO} from '../adapters/investment-adapter.js';


export class InvestmentRepository {
  userId: string;
  sequelize: Sequelize;

  constructor(userId: string, sequelize: Sequelize) {
    this.userId = userId;
    this.sequelize = sequelize;
  }

  async getAllInvestmentRecords() {
    const investments = await InvestmentRecord.findAll({
      where: {
        userId: this.userId,
      },
      // order: [['date_purchase', 'DESC']],
    });

    return investments.map((investment) => adaptInvestmentDTO(investment));
  }
}