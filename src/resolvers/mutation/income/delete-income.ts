import { MutationResolvers } from '../../../generated/graphql.js';
import { logger } from '../../../logger.js';
import { Income } from '../../../models/income.js';
import { deleteElement, validateId } from '../../../utils/sequilize-utils.js';

export const deleteIncomeById: MutationResolvers['deleteIncomeById'] = async (
  _,
  input,
  context
) => {
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
