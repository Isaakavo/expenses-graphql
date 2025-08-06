import { logger } from '../logger.js';
import { sequelize } from '../database/index.js';
import { Income } from '../models/index.js';
import { Period } from '../models/periods.js';
import { PeriodRepository } from './period-repository.js';

export class IncomeRepository {
  private periodRepository: PeriodRepository;
  userId: string;

  constructor(userId: string) {
    this.userId = userId;
    this.periodRepository = new PeriodRepository(userId);
  }

  async getAllIncomes() {
    return Income.findAll({
      where: {
        userId: this.userId,
      },
      include: [
        {
          model: Period,
          as: 'period',
          where: {
            userId: this.userId,
          },
        },
      ],
      order: [['paymentDate', 'DESC']],
    });
  }

  async createIncome(incomeData: Partial<Income>) {
    return await sequelize.transaction(async (t) => {
      const period: Period = await this.periodRepository.createPeriod(
        incomeData.paymentDate,
        { transaction: t }
      );

      logger.info(`Period created with id ${period.id} for income`);

      const income = await Income.create(
        { ...incomeData, periodId: period.id },
        { transaction: t }
      );

      const incomeWithPeriod = {
        ...income.get(),
        period_id: period.id,
        period: period,
      } as Income;

      return incomeWithPeriod;
    });
  }
}
