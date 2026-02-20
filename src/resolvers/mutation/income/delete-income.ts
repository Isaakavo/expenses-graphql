import { MutationResolvers } from '../../../generated/graphql.js';
import { IncomeService } from '../../../service/income-service.js';

export const deleteIncomeById: MutationResolvers['deleteIncomeById'] = async (
  _,
  input,
  context
) => {
  const {
    user: { userId },
    sequelizeClient
  } = context;
  const incomeService = new IncomeService(userId, sequelizeClient);

  return incomeService.deleteIncome(input);
};
