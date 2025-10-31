import { ExpensesService } from '../../../service/expenses-service.js';
import { QueryResolvers } from '../../../generated/graphql.js';
import { IncomeService } from '../../../service/income-service.js';
import { formatCurrency } from '../../../adapters/income-adapter.js';
import { adaptGroupedExpenses } from '../../../adapters/expense-adapter.js';

export const incomesWithExpenses: QueryResolvers['incomesWithExpenses'] =
  async (_, { input }, context) => {
    const {
      user: { userId },
      sequilizeClient,
    } = context;

    const { startDate, endDate, periodId } = input;

    const incomesService = new IncomeService(userId, sequilizeClient);
    const expensesService = new ExpensesService(userId, sequilizeClient);

    const { incomes, incomesTotal } = await incomesService.getIncomeByPeriod(
      periodId,
      startDate,
      endDate
    );
    const { expenses, expensesTotal } =
      await expensesService.getExpensesGroupedExpenses(periodId, startDate, endDate);
      
    return {
      incomes,
      expenses: adaptGroupedExpenses(expenses),
      incomesTotal: formatCurrency(incomesTotal),
      expensesTotal: formatCurrency(expensesTotal),
      remaining: formatCurrency(incomesTotal - expensesTotal),
    };
  };
