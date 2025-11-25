import {QueryResolvers} from '../../../generated/graphql.js';
import {InvestmentService} from '../../../service/investment-service.js';
import {logger} from '../../../logger.js';


export const udiValue: QueryResolvers['udiValue'] = async (
  _,
  __,
  {
    user: {userId},
    sequelizeClient
  },
) => {
  try{
    const investmentService = new InvestmentService(userId, sequelizeClient);

    const udiValue =  await investmentService.fetchUdiValue();
    return {
      amount: udiValue.dato,
      date: udiValue.fecha
    }
  }catch (e) {
    logger.error(`all investment records: ${e.message}`)
  }
}