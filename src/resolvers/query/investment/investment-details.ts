import {QueryResolvers} from '../../../generated/graphql.js';
import {InvestmentService} from '../../../service/investment-service.js';
import {logger} from '../../../logger.js';
import {formatCurrency} from '../../../adapters/income-adapter.js';


export const investmentDetails: QueryResolvers['investmentDetails'] = async (
  _,
  __,
  {
    user: {userId},
    sequelizeClient
  },
) =>{
  try {
    const investmentService = new InvestmentService(userId, sequelizeClient);

    const result = await investmentService.calculateInvestmentDetails();

    return {
      totalSpent: formatCurrency(result.totalSpent),
      totalOfUdis: Number(result.totalOfUdis.toFixed(2)),
      udiValue: result.udiValue,
      financialReturn: formatCurrency(result.financialReturn),
      conversion: formatCurrency(result.conversion),
    }
  } catch (e) {
    logger.error(e.message);
  }
}