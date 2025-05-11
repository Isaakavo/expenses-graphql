import { adaptExpensesWithCard } from '../../../adapters/index.js';
import { Expense, Card } from '../../../models/index.js';
import { validateId } from '../../../utils/sequilize-utils.js';

export const expenseById = async (_, { id }, context) => {
  const {
    user: { userId },
  } = context;

  const expense = (await validateId(Expense, userId, id)) as Expense;

  const card = await Card.findOne({
    where: {
      userId,
      id: expense.cardId,
    },
  });

  return adaptExpensesWithCard(expense, card);
};
