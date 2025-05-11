import { logger } from '../../../logger.js';
import { Expense } from '../../../models/index.js';
import { validateId, deleteElement } from '../../../utils/sequilize-utils.js';

export const deleteExpense = async (_, { id }, context) => {
  try {
    const {
      user: { userId },
    } = context;

    await validateId(Expense, userId, id);

    return deleteElement(Expense, userId, id);
  } catch (error) {
    logger.error(error);
    return error;
  }
};
