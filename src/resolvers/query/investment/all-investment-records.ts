import {QueryResolvers} from '../../../generated/graphql.js';
import {InvestmentService} from '../../../service/investment-service.js';
import {adaptInvestment} from '../../../adapters/investment-adapter.js';


export const allInvestmentRecords: QueryResolvers['allInvestmentRecords'] = async (
  _,
  __,
  {
    user: {userId},
    sequelizeClient
  },
) => {
  const investmentService = new InvestmentService(userId, sequelizeClient);

  const investments = await investmentService.getAllInvestmentRecords();

  return investments.map((investment) => adaptInvestment(investment));
}
