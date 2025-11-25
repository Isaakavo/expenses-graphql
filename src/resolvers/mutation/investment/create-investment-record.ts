import {MutationResolvers} from '../../../generated/graphql.js';
import {InvestmentService} from '../../../service/investment-service.js';
import {logger} from '../../../logger.js';
import {adaptInvestment} from '../../../adapters/investment-adapter.js';


export const createInvestmentRecord: MutationResolvers['createInvestmentRecord'] = async (
  _,
  {
    input: {
      date,
      amount,
      udiValue
    }
  },
  {
    user: {
      userId
    },
    sequelizeClient
  }
) => {
  try {
    const investmentService = new InvestmentService(userId, sequelizeClient);

    const inserted = await investmentService.createInvestmentRecord(
      {
        purchasedOn: date,
        amount,
        udiValue,
      }
    );

    return adaptInvestment(inserted);
  }catch (e) {
    logger.error(`${e.message} ${e.stack}`);
  }
}