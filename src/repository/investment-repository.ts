import {InvestmentRecord} from '../models/investment-record.js';
import {Sequelize} from 'sequelize';
import {adaptInvestmentDTO, adaptInvestmentFeeDTO} from '../adapters/investment-adapter.js';
import {InvestmentFeeRecord} from '../models/investment-fee-record.js';
import {InvestmentDto} from '../dto/investment-dto.js';


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

  async createInvestmentRecord(input: InvestmentRecordInput): Promise<InvestmentDto> {
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
      order: [['date_purchase', 'DESC']],
    });

    return investments.map((investment) => adaptInvestmentDTO(investment));
  }

  async getInvestmentFee(id: number) {
    const investments = await InvestmentFeeRecord.findByPk(id)

    return adaptInvestmentFeeDTO(investments)
  }
}