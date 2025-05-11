import { GraphQLError } from 'graphql';
import { adaptSingleIncome } from '../../../adapters/index.js';
import { logger } from '../../../logger.js';
import { Income } from '../../../models/index.js';
import { calcualteTotalByMonth } from '../../../utils/calculate-total.js';

export const incomesList = async (_, __, context) => {
  try {
    const {
      user: { userId },
    } = context;

    //TODO implement logic in the query to receive the order of filtering from the client
    const allIncomes = await Income.findAll({
      where: {
        userId,
      },
      order: [['paymentDate', 'DESC']],
    });

    logger.info(`returning ${allIncomes.length} incomes`);

    return {
      incomes: allIncomes.map((x) => adaptSingleIncome(x)),
      totalByMonth: calcualteTotalByMonth(allIncomes),
      total: allIncomes.reduce(
        (acumulator, currentValue) => acumulator + currentValue.total,
        0
      ),
    };
  } catch (error) {
    if (error instanceof GraphQLError) {
      logger.error(`Graphql Error incomes list ${error.message}`);
      throw error;
    }
    logger.error(`Error incomes list ${error}`);
  }
};
