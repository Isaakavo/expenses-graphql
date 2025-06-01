import { GraphQLError } from 'graphql';
import {
  CreateIncomeInput,
  MutationDeleteIncomeByIdArgs,
} from '../generated/graphql.js';
import { Context } from '../index.js';
import { logger } from '../logger.js';
import { Income } from '../models/income.js';
import { Date as CustomDate } from '../scalars/date.js';

export class IncomeService {
  async createIncome(input: CreateIncomeInput, context: Context) {
    const { total, paymentDate, comment } = input;
    const {
      user: { userId },
    } = context;
    const parsedPaymentDay = CustomDate.parseValue(paymentDate);
    const parsedCreatedAt = CustomDate.parseValue(new Date().toISOString());

    return await Income.create({
      userId,
      total,
      comment: comment?.trim() ?? '',
      paymentDate: parsedPaymentDay,
      createdAt: parsedCreatedAt,
    });
  }

  async deleteIncome(input: MutationDeleteIncomeByIdArgs, context: Context) {
    const { id } = input;
    const {
      user: { userId },
    } = context;
    const isDeleted = await Income.destroy({ where: { id, userId } });

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
}
