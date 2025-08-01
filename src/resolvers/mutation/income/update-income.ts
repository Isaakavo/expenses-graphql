import { IncomeService } from '../../../service/income-service.js';
import { adaptSingleIncome } from '../../../adapters/income-adapter.js';
import { MutationResolvers } from '../../../generated/graphql.js';

export const updateIncome: MutationResolvers['updateIncome'] = async (
  _,
  { input },
  context
) => {
  const incomeService = new IncomeService(context.user.userId);

  const updatedIncome = await incomeService.updateIncome(input);  

  return adaptSingleIncome(updatedIncome[0]);
};
