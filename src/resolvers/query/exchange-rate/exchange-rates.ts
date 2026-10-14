import { format } from 'date-fns';
import { adaptExchangeRate } from '../../../adapters/exchange-rate-adapter.js';
import { QueryResolvers } from '../../../generated/graphql.js';
import { exchangeRateService } from '../../../service/exchange-rate-service.js';

const toIsoDate = (date: Date) => format(date, 'yyyy-MM-dd');

export const exchangeRates: QueryResolvers['exchangeRates'] = async (
  _,
  { base, quote, startDate, endDate }
) =>
  (
    await exchangeRateService.getRates(base, quote, toIsoDate(startDate), toIsoDate(endDate))
  ).map(adaptExchangeRate);
