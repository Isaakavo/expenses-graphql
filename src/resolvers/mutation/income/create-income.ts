import { IncomeService } from '../../../service/income-service.js';
import { MutationResolvers } from '../../../generated/graphql.js';
import { logger } from '../../../logger.js';
import { adaptSingleIncome } from '../../../adapters/income-adapter.js';

//TODO implement logic to handle the create of incomes for 1 year
// add a new flag to indicate if the mutation should create 12 new incomes with the provided inputs
export const createIncome: MutationResolvers['createIncome'] = async (
  _,
  { input },
  context
) => {

  const incomeService = new IncomeService(context.user.userId);
  const newIncome = await incomeService.createIncome(input);

  logger.info(`Income added with id ${newIncome.income.id}`);
  return adaptSingleIncome(newIncome.income);
};
