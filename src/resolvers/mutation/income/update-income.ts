import {
  adaptSingleIncome
} from '../../../adapters/income-adapter.js';
import { MutationResolvers } from '../../../generated/graphql.js';
import { IncomeService } from '../../../service/income-service.js';

export const updateIncome: MutationResolvers['updateIncome'] = async (
  _,
  { input },
  context
) => {
  const {
    user: { userId },
    sequilizeClient,
  } = context;
  const incomeService = new IncomeService(userId, sequilizeClient);

  const updatedIncome = await incomeService.updateIncome({
    id: input.incomeId,
    total: input.total,
    comment: input.comment,
    paymentDate: input.paymentDate,
  });  

  return adaptSingleIncome(updatedIncome);
};
