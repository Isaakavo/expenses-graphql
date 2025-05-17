import { adaptSingleIncome } from '../../../adapters/index.js';
import { QueryResolvers } from '../../../generated/graphql.js';
import { logger } from '../../../logger.js';
import { Income } from '../../../models/index.js';

export const incomeById: QueryResolvers['incomeById'] = async (
  _,
  { incomeId },
  context
) => {
  try {
    const {
      user: { userId },
    } = context;

    const income = await Income.findOne({
      where: {
        userId,
        id: incomeId,
      },
    });

    return adaptSingleIncome(income);
  } catch (error) {
    logger.error(error);
  }
};
