import { ExpensesService } from '../../../service/expenses-service.js';
import { QueryResolvers } from '../../../generated/graphql.js';
import { IncomeService } from '../../../service/income-service.js';
import { formatCurrency } from '../../../adapters/income-adapter.js';
import { adaptGroupedExpenses } from '../../../adapters/expense-adapter.js';

export const incomesWithExpenses: QueryResolvers['incomesWithExpenses'] =
  async (_, { input }, context) => {
    const {
      user: { userId },
      sequelizeClient,
    } = context;

    const { startDate, endDate, periodId } = input;

    const incomesService = new IncomeService(userId, sequelizeClient);
    const expensesService = new ExpensesService(userId, sequelizeClient);

    const { incomes, incomesTotal } = await incomesService.getIncomeByPeriod(
      periodId,
      startDate,
      endDate
    );
    const { expenses, expensesTotal } =
      await expensesService.getExpensesGroupedExpenses(periodId, startDate, endDate);
      
    return {
      incomes,
      groupedExpenses: adaptGroupedExpenses(expenses),
      incomesTotal: formatCurrency(incomesTotal),
      expensesTotal: formatCurrency(expensesTotal),
      remaining: formatCurrency(incomesTotal - expensesTotal),
    };
  };
