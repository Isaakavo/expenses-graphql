import { logger } from '../../../logger.js';
import { findAllExpensesWithCards } from '../../../utils/expenses-utils.js';
import { whereByMonth } from '../../../utils/where-fortnight.js';

export const expensesByMonth = async (_, { input }, context) => {
  const { payBefore, cardId } = input;
  const {
    user: { userId },
  } = context;

  const where = !cardId
    ? whereByMonth(userId, payBefore, 'payBefore')
    : whereByMonth(userId, payBefore, 'payBefore', { cardId });

  const expenses = await findAllExpensesWithCards(where);
  const expensesTotal = expenses.reduce(
    (acumulator, currentValue) => acumulator + currentValue.total,
    0
  );

  logger.info(`Returning ${expenses.length} expenses`);

  return {
    expenses,
    expensesTotal,
  };
};
