import { ExchangeRate } from '../generated/graphql.js';
import { ExchangeRateResult } from '../service/exchange-rate-service.js';

export const adaptExchangeRate = (result: ExchangeRateResult): ExchangeRate => ({
  ...result,
  rateDate: new Date(`${result.rateDate}T00:00:00Z`),
});
