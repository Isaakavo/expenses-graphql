import { IncomeService } from '../../../service/income-service.js';
import { MutationResolvers } from '../../../generated/graphql.js';
import { adaptSingleIncome } from '../../../adapters/income-adapter.js';
import { logger } from '../../../logger.js';

//TODO implement logic to handle the create of incomes for 1 year
// add a new flag to indicate if the mutation should create 12 new incomes with the provided inputs
export const createIncome: MutationResolvers['createIncome'] = async (
  _,
  { input },
  context
) => {
  const {
    user: { userId },
    sequilizeClient,
  } = context;

  try {
    const incomeService = new IncomeService(userId, sequilizeClient);
    const newIncome = await incomeService.createIncome(input);

    return adaptSingleIncome(newIncome);
  } catch (error) {
    logger.error(error);
  }
};
