import { GraphQLError } from 'graphql';
import { Op } from 'sequelize';
import { QueryResolvers } from '../../../generated/graphql.js';
import { logger } from '../../../logger.js';
import { findAllExpensesWithCards } from '../../../utils/expenses-utils.js';

export const allExpensesByDateRange: QueryResolvers['allExpensesByDateRange'] =
  async (_, { input }, context) => {
    const {
      user: { userId },
    } = context;
    const { endDate, initialDate } = input;

    const parsedEndDate = new Date(endDate.year, endDate.month, endDate.day);
    const parsedStartDate = new Date(
      initialDate.year,
      initialDate.month,
      initialDate.day
    );

    if (parsedEndDate < parsedStartDate) {
      logger.error('end date must be ahead of start date');
      throw new GraphQLError('Wrong dates');
    }

    logger.info(`Start date: ${parsedStartDate} End date: ${parsedEndDate}`);
    return findAllExpensesWithCards({
      userId,
      payBefore: { [Op.gte]: parsedStartDate, [Op.lte]: parsedEndDate },
    });
  };
