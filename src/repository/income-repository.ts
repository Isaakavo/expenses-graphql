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
      const periodType = 'WEEKLY';
      let period: Period;

      switch (periodType) {
      case 'WEEKLY':
        period = await this.periodRepository.createWeeklyPeriod(
          incomeData.paymentDate,
          { type: periodType },
          { transaction: t }
        );
        break;
      // case 'FORTNIGHTLY':
      //   break;
      // case 'MONTHLY':
      //   break;
      default:
        throw new Error('Invalid period type');
      }

      // const period = await this.periodRepository.createWeeklyPeriod(
      //   incomeData.paymentDate,
      //   { transaction: t }
      // );
      const income = await Income.create(
        { ...incomeData, periodId: period.id },
        { transaction: t }
      );
      return { income, period };
    });
  }
}
