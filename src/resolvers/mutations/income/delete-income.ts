import { logger } from '../../../logger.js';
import { Income } from '../../../models/income.js';
import { validateId, deleteElement } from '../../../utils/sequilize-utils.js';

export const deleteIncomeById = async (_, input, context) => {
  try {
    const { id } = input;
    const {
      user: { userId },
    } = context;

    await validateId(Income, userId, id);

    return deleteElement(Income, userId, id);
  } catch (error) {
    logger.error(error);
    return error;
  }
};
