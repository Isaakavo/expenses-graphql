import { IncomeService } from '../../../service/income-service.js';
import { adaptIncomeDTO, adaptSingleIncome } from '../../../adapters/income-adapter.js';
import { MutationResolvers } from '../../../generated/graphql.js';

export const updateIncome: MutationResolvers['updateIncome'] = async (
  _,
  { input },
  context
) => {

  const { user: { userId }, sequilizeClient } = context;
  const incomeService = new IncomeService(userId, sequilizeClient);

  const updatedIncome = await incomeService.updateIncome(input);  

  return adaptSingleIncome(adaptIncomeDTO(updatedIncome[0]));
};
