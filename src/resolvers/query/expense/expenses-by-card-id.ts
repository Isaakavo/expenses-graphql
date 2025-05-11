import {
  TotalByFortnight,
  Expense as GraphqlExpense,
} from '../../../generated/graphql.js';
import { logger } from '../../../logger.js';
import {
  calcualteTotalByMonth,
  calculateTotalByFortnight,
} from '../../../utils/calculate-total.js';
import { findAllExpensesWithCards } from '../../../utils/expenses-utils.js';

export const expensesTotalByCardId = async (_, { cardId }, context) => {
  const {
    user: { userId },
  } = context;

  const expenses = await findAllExpensesWithCards({ userId, cardId });
  const totalByMonth = calcualteTotalByMonth(expenses);
  const totalByFortnight = calculateTotalByFortnight<
    GraphqlExpense,
    TotalByFortnight
  >(expenses);

  logger.info(`Returning information for card ${cardId}`);
  return {
    totalByMonth,
    totalByFortnight,
  };
};
