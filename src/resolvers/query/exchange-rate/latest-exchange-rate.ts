import { adaptExchangeRate } from '../../../adapters/exchange-rate-adapter.js';
import { QueryResolvers } from '../../../generated/graphql.js';
import { exchangeRateService } from '../../../service/exchange-rate-service.js';

export const latestExchangeRate: QueryResolvers['latestExchangeRate'] = async (
  _,
  { base, quote }
) =>
  adaptExchangeRate(
    await exchangeRateService.getRate(base, quote, exchangeRateService.today())
  );
