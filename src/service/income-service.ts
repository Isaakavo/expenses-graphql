import { GraphQLError } from 'graphql';
import {
  CreateIncomeInput,
  MutationDeleteIncomeByIdArgs,
  UpdateIncomeInput,
} from '../generated/graphql.js';
import { Context } from '../index.js';
import { logger } from '../logger.js';
import { Income } from '../models/income.js';
import { Date as CustomDate } from '../scalars/date.js';
import { validateId } from '../utils/sequilize-utils.js';

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

  async updaIncome(input: UpdateIncomeInput, context: Context) {
    const { incomeId, total, comment, paymentDate } = input;
    const {
      user: { userId },
    } = context;

    await validateId(Income, userId, incomeId);

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
        where: { id: incomeId, userId },
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
}
