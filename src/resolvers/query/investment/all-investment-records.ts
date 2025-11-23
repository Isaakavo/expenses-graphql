import {QueryResolvers} from '../../../generated/graphql.js';
import {InvestmentService} from '../../../service/investment-service.js';
import {logger} from '../../../logger.js';
import {adaptInvestment} from '../../../adapters/investment-adapter.js';


export const allInvestmentRecords: QueryResolvers['allInvestmentRecords'] = async (
  _,
  __,
  {
    user: {userId},
    sequelizeClient
  },
) => {
  try{
    const investmentService = new InvestmentService(userId, sequelizeClient);

    const investments = await investmentService.getAllInvestmentRecords();

    return investments.map((investment) => adaptInvestment(investment));
  }catch (e) {
    logger.error(`all investment records: ${e.message}`)
  }
}