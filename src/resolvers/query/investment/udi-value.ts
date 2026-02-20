import {QueryResolvers} from '../../../generated/graphql.js';
import {InvestmentService} from '../../../service/investment-service.js';


export const udiValue: QueryResolvers['udiValue'] = async (
  _,
  __,
  {
    user: {userId},
    sequelizeClient
  },
) => {
  const investmentService = new InvestmentService(userId, sequelizeClient);

  const udiValue =  await investmentService.fetchUdiValue();
  return {
    amount: udiValue.dato,
    date: udiValue.fecha
  }
}
