import { QueryTypes, Sequelize, Transaction } from 'sequelize';
import { logger } from '../logger.js';
import { adaptSavingsFundDTO } from '../adapters/goal-adapter.js';
import { SavingsFundDTO } from '../dto/index.js';
import { CurrencyCode } from '../generated/graphql.js';
import { SavingsFund } from '../models/index.js';

export class SavingsFundRepository {
  userId: string;
  sequelize: Sequelize;

  constructor(userId: string, sequelize: Sequelize) {
    this.userId = userId;
    this.sequelize = sequelize;
  }

  async getFunds(): Promise<SavingsFundDTO[]> {
    const funds = await SavingsFund.findAll({
      where: { userId: this.userId },
      order: [['createdAt', 'ASC']],
    });

    return funds.map(adaptSavingsFundDTO);
  }

  async getFundByPk(id: string): Promise<SavingsFundDTO | null> {
    const fund = await SavingsFund.findOne({
      where: { id, userId: this.userId },
    });

    return fund ? adaptSavingsFundDTO(fund) : null;
  }

  async getOrCreateFirstFund(
    name: string,
    currency: () => Promise<CurrencyCode>
  ): Promise<SavingsFundDTO> {
    return this.sequelize.transaction(async (transaction: Transaction) => {
      await this.sequelize.query('SELECT pg_advisory_xact_lock(hashtext(:userId))', {
        replacements: { userId: this.userId },
        type: QueryTypes.SELECT,
        transaction,
      });

      const existing = await SavingsFund.findOne({
        where: { userId: this.userId },
        order: [['createdAt', 'ASC']],
        transaction,
      });
      if (existing) {
        return adaptSavingsFundDTO(existing);
      }

      const fund = await SavingsFund.create(
        { name, currency: await currency(), userId: this.userId },
        { transaction }
      );

      logger.info(`Created savings fund id ${fund.id} for user ${this.userId}`);

      return adaptSavingsFundDTO(fund);
    });
  }
}
