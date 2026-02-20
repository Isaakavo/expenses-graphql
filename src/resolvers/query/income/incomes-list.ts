import { adaptIncome } from '../../../adapters/income-adapter.js';
import { QueryResolvers } from '../../../generated/graphql.js';
import { logger } from '../../../logger.js';
import { IncomeService } from '../../../service/income-service.js';
import { calcualteTotalByMonth } from '../../../utils/calculate-total.js';

export const incomesList: QueryResolvers['incomesList'] = async (
  _,
  __,
  context
) => {
  const {
    user: { userId },
    sequelizeClient,
  } = context;

  const incomeService = new IncomeService(userId, sequelizeClient);

  //TODO implement logic in the query to receive the order of filtering from the client
  const allIncomes = await incomeService.getAllIncomes();

  logger.info(`returning ${allIncomes.length} incomes`);

  return {
    incomes: allIncomes.map((income) => adaptIncome(income)),
    totalByMonth: calcualteTotalByMonth(allIncomes),
    total: allIncomes.reduce(
      (acumulator, currentValue) => acumulator + currentValue.total,
      0
    ),
  };
};
