import { Sequelize } from 'sequelize';
import {
  adaptIncomeDTO,
  adaptSingleIncome,
} from '../adapters/income-adapter.js';
import {
  CreateIncomeInput,
  MutationDeleteIncomeByIdArgs,
} from '../generated/graphql.js';
import { logger } from '../logger.js';
import { Income } from '../models';
import { IncomeRepository } from '../repository/income-repository.js';
import { PeriodRepository } from '../repository/period-repository.js';
import { Date as CustomDate } from '../scalars/date.js';

export type IncomeInput = {
  id: string;
  total: number;
  comment?: string;
  periodId?: string;
  paymentDate: Date;
};

export class IncomeService {
  private incomeRepository: IncomeRepository;
  private periodRepository: PeriodRepository;
  userId: string;
  sequelize: Sequelize;

  constructor(userId: string, sequelize: Sequelize) {
    this.userId = userId;
    this.sequelize = sequelize;
    this.incomeRepository = new IncomeRepository(userId, sequelize);
    this.periodRepository = new PeriodRepository(userId, sequelize);
  }

  async getAllIncomes() {
    return (await this.incomeRepository.getAllIncomes()).map((income) =>
      adaptIncomeDTO(income)
    );
  }

  async getIncomeByPeriod(periodId?: string, startDate?: Date, endDate?: Date) {
    const parsedStartDate = startDate
      ? CustomDate.parseValue(startDate)
      : undefined;
    const parsedEndDate = endDate ? CustomDate.parseValue(endDate) : undefined;

    const incomes = await this.incomeRepository.getIncomeByPeriod(
      this.userId,
      periodId,
      parsedStartDate,
      parsedEndDate
    );

    const incomesTotal = this.calculateTotal(incomes);
    const adaptedIncome = await Promise.all(
      incomes.map(async (income) => {
        return adaptSingleIncome(adaptIncomeDTO(income));
      })
    );

    return Promise.resolve({
      incomes: adaptedIncome,
      incomesTotal,
    });
  }

  async getIncomeBy() {
    // TODO add logic to handle different type of grouping income by period
    return this.incomeRepository.getIncomeByMonth();
  }

  async createIncome(input: CreateIncomeInput) {
    const { total, paymentDate, comment } = input;
    const parsedPaymentDay = CustomDate.parseValue(paymentDate);
    const parsedCreatedAt = CustomDate.parseValue(new Date().toISOString());
    const incomeData = {
      userId: this.userId,
      total,
      comment: comment?.trim() ?? '',
      paymentDate: parsedPaymentDay,
      createdAt: parsedCreatedAt,
    };

    return adaptIncomeDTO(await this.incomeRepository.createIncome(incomeData));
  }

  async deleteIncome(input: MutationDeleteIncomeByIdArgs) {
    const { id } = input;
    return this.incomeRepository.deleteIncomeById(id);
  }

  async updateIncome(input: IncomeInput) {
    const { id, total, comment, paymentDate } = input;
    const transaction = await this.sequelize.transaction();

    try {
      const period = await this.periodRepository.getPeriodBy(
        { date: input.paymentDate },
        { transaction }
      );

      if (!period) {
        logger.error('No period found for the given payBefore date');
      }

      const updated = await this.incomeRepository.updateIncome(
        {
          id,
          total,
          comment,
          paymentDate,
          periodId: period.id
        },
        {
          transaction,
        }
      );
      await transaction.commit();
      return updated;
    } catch (error) {
      logger.error('Error updating income: ' + error.message);
      await transaction.rollback();
      throw error;
    }
  }

  calculateTotal(incomes: Income[]) {
    return incomes.reduce((acc, income) => acc + income.total, 0);
  }
}
