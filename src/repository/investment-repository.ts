import {InvestmentRecord} from '../models/investment-record.js';
import {Sequelize} from 'sequelize';
import {adaptInvestmentDTO} from '../adapters/investment-adapter.js';


export type InvestmentRecordInput = {
  amount: number;
  udiValue?: number;
  udiAmount?: number;
  purchasedOn: Date;
}

export class InvestmentRepository {
  userId: string;
  sequelize: Sequelize;

  constructor(userId: string, sequelize: Sequelize) {
    this.userId = userId;
    this.sequelize = sequelize;
  }

  async createInvestmentRecord(input: InvestmentRecordInput) {
    const inserted = await InvestmentRecord.create({
      ...input,
      userId: this.userId,
      //TODO this should be another table
      udi_commission: 1,
    });

    return adaptInvestmentDTO(inserted)
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