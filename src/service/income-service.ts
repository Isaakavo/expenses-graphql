import { GraphQLError } from 'graphql';
import {
  CreateIncomeInput,
  MutationDeleteIncomeByIdArgs,
  UpdateIncomeInput,
} from '../generated/graphql.js';
import { logger } from '../logger.js';
import { Income } from '../models/income.js';
import { Date as CustomDate } from '../scalars/date.js';
import { validateId } from '../utils/sequilize-utils.js';
import { IncomeRepository } from '../repository/income-repository.js';
import { adaptSingleIncome } from '../adapters/income-adapter.js';
import { Sequelize } from 'sequelize';

export class IncomeService {
  private incomeRepository: IncomeRepository;
  userId: string;

  constructor(userId: string, sequelize: Sequelize) {
    this.userId = userId;
    this.incomeRepository = new IncomeRepository(userId, sequelize);
  }

  async getAllIncomes() {
    return this.incomeRepository.getAllIncomes();
  }

  async getIncomeByPeriod(
    periodId?: string,
    startDate?: Date,
    endDate?: Date
  ) {
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

    const incomesTotal = this.calculateTotal(incomes)
    const adaptedIncome = await Promise.all(
      incomes.map(async (income) => {
        return adaptSingleIncome(income);
      })
    );

    return Promise.resolve({
      incomes: adaptedIncome,
      incomesTotal
    })
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

    return await this.incomeRepository.createIncome(incomeData);
  }

  async deleteIncome(input: MutationDeleteIncomeByIdArgs) {
    const { id } = input;
    const isDeleted = await Income.destroy({
      where: { id, userId: this.userId },
    });

    if (isDeleted === 0) {
      logger.info(`Couldnt delete Income with id ${id}`);
      throw new GraphQLError('Couldnt delete Income', {
        extensions: {
          code: 'CONFLICT',
          http: { status: 409 },
        },
      });
    }

    logger.info(`Deleted ${isDeleted} Income`);
    return true;
  }

  async updateIncome(input: UpdateIncomeInput) {
    const { incomeId, total, comment, paymentDate } = input;

    await validateId(Income, this.userId, incomeId);

    const updateParams = {
      total,
      comment: comment?.trim() ?? '',
      paymentDate: CustomDate.parseValue(paymentDate),
      updatedAt: CustomDate.parseValue(new Date().toISOString()),
    };

    const [affectedCount, updatedElement] = await Income.update(
      {
        ...updateParams,
      },
      {
        where: { id: incomeId, userId: this.userId },
        returning: true,
      }
    );

    if (updatedElement.length === 0) {
      logger.info('Couldt update Income, id doesnt exists');
      throw new GraphQLError('Income id not found', {
        extensions: {
          code: 'NOT_FOUND',
          http: { status: 404 },
        },
      });
    }

    logger.info(`Updated Income, affectedCount ${affectedCount}`);

    return updatedElement;
  }

  calculateTotal(incomes: Income[]) {
    return incomes.reduce((acc, income) => acc + income.total, 0);
  }
}
