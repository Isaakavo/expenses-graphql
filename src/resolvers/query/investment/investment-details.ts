import {QueryResolvers} from '../../../generated/graphql.js';
import {InvestmentService} from '../../../service/investment-service.js';
import {formatCurrency} from '../../../adapters/income-adapter.js';


export const investmentDetails: QueryResolvers['investmentDetails'] = async (
  _,
  __,
  {
    user: {userId},
    sequelizeClient
  },
) =>{
  const investmentService = new InvestmentService(userId, sequelizeClient);

  const result = await investmentService.calculateInvestmentDetails();

  return {
    totalSpent: formatCurrency(result.totalSpent),
    totalOfUdis: Number(result.totalOfUdis.toFixed(2)),
    udiValue: result.udiValue,
    financialReturn: formatCurrency(result.financialReturn),
    conversion: formatCurrency(result.conversion),
  }
}
