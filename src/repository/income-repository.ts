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

      let income = await Income.findOne({
        where: {
          userId: this.userId,
          periodId: period.id,
        },
      });

      if (!income) {
        income = await Income.create(
          { ...incomeData, periodId: period.id },
          { transaction: t }
        );
        logger.info(
          `Created new income for user ${this.userId} on date ${incomeData.paymentDate}`
        );
      }

      if (income.total !== incomeData.total) {
        logger.info(
          `Updating existing income with id ${income.id} for user ${this.userId}`
        );
        income = await income.update(
          { total: incomeData.total },
          { transaction: t }
        );
      } else {
        logger.info(
          `Income already exists for user ${this.userId} on date ${incomeData.paymentDate}`
        );
      }

      const incomeWithPeriod = {
        ...income.get(),
        period_id: period.id,
        period: period,
      } as Income;

      return incomeWithPeriod;
    });
  }
}
