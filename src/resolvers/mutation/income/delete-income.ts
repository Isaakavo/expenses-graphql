import { MutationResolvers } from '../../../generated/graphql.js';
import { logger } from '../../../logger.js';
import { Income } from '../../../models/income.js';
import { IncomeService } from '../../../service/income-service.js';
import { validateId } from '../../../utils/sequilize-utils.js';

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

    const incomeService = new IncomeService(context.user.userId);

    await validateId(Income, userId, id);

    return incomeService.deleteIncome(input);
  } catch (error) {
    logger.error(error);
    return error;
  }
};
