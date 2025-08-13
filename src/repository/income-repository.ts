import { formatInTimeZone } from 'date-fns-tz';
import { FindOptions, Op, QueryTypes, Sequelize } from 'sequelize';
import { adaptIncome, } from '../adapters/income-adapter.js';
import { logger } from '../logger.js';
import { CategorySettings } from '../models/category-settings.js';
import { IncomeCategoryAllocation } from '../models/income-category-allocation.js';
import { Income } from '../models/index.js';
import { Period } from '../models/periods.js';
import { toCamelCaseDeep } from '../utils/case-converter.js';
import { PeriodRepository } from './period-repository.js';

export class IncomeRepository {
  private periodRepository: PeriodRepository;
  userId: string;
  sequelize: Sequelize;

  constructor(userId: string, sequelize: Sequelize) {
    this.userId = userId;
    this.sequelize = sequelize;
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

  async getIncomeByPeriod(
    userId: string,
    periodId?: string,
    startDate?: Date,
    endDate?: Date
  ) {
    const where: FindOptions['where'] = { userId };

    if (periodId) {
      where.periodId = periodId;
    } else if (startDate && endDate) {
      where.paymentDate = {
        [Op.between]: [startDate, endDate],
      };
    }

    return Income.findAll({
      where,
      include: [
        {
          model: Period,
          as: 'period',
          where: { userId },
        },
      ],
      order: [['paymentDate', 'DESC']],
    });
  }

  async getIncomeByMonth() {
    const results = (await this.sequelize.query(
      `
      SELECT
      DATE_TRUNC('month', i."payment_date") AS month,
      SUM(i.total) AS total,
      JSON_AGG(
        jsonb_build_object(
          'income', i,
          'period', p
        )
        ORDER BY i.payment_date DESC
      ) AS incomes
      FROM incomes i
      LEFT JOIN periods p ON i.period_id = p.id
      GROUP BY month
      ORDER BY month DESC;
    `,
      {
        replacements: { userId: this.userId },
        type: QueryTypes.SELECT,
      }
    ));

    logger.info(`returning ${results.length} incomes`);

    return toCamelCaseDeep(results).map((r) => {
      return {
        month: formatInTimeZone(new Date(r.month), 'UTC', 'MMMM'),
        year: formatInTimeZone(new Date(r.month), 'UTC', 'yyyy'),
        total: r.total,
        incomes: r.incomes.map((x) => adaptIncome(x)),
      };
    });
  }

  async createIncome(incomeData: Partial<Income>) {
    return await this.sequelize.transaction(async (t) => {
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

      // TODO this should be its own respository
      const categorySetting = await CategorySettings.findAll({
        where: {
          userId: this.userId,
        },
      });

      await Promise.all(
        categorySetting.map(async (setting) => {
          const [allocation, created] =
            // TODO this should be its own respository
            await IncomeCategoryAllocation.findOrCreate({
              where: {
                userId: this.userId,
                incomeId: income.id,
                categoryId: setting.categoryId,
              },
              defaults: {
                percentage: setting.percentage,
                amountAllocated: income.total * setting.percentage,
              },
              transaction: t,
            });

          if (!created) {
            // Update allocation if percentage or amountAllocated changed
            if (
              allocation.percentage !== setting.percentage ||
              allocation.amountAllocated !== income.total * setting.percentage
            ) {
              await allocation.update(
                {
                  percentage: setting.percentage,
                  amountAllocated: income.total * setting.percentage,
                },
                { transaction: t }
              );
            }
          }
        })
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
