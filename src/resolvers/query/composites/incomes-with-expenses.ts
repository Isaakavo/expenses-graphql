import { ExpensesService } from '../../../service/expenses-service.js';
import { QueryResolvers } from '../../../generated/graphql.js';
import { IncomeService } from '../../../service/income-service.js';
import { formatCurrency } from '../../../adapters/income-adapter.js';

export const incomesWithExpenses: QueryResolvers['incomesWithExpenses'] =
  async (_, { input }, context) => {
    const {
      user: { userId },
      sequilizeClient,
    } = context;

    const { startDate, endDate, periodId, subCategoryIds } = input;

    const incomesService = new IncomeService(userId, sequilizeClient);
    const expensesService = new ExpensesService(userId);

    const { incomes, incomesTotal } = await incomesService.getIncomeByPeriod(
      periodId,
      startDate,
      endDate
    );
    const { expenses, expensesTotal } =
      await expensesService.getExpensesByPeriod(periodId, startDate, endDate, subCategoryIds);

    return {
      incomes,
      expenses,
      incomesTotal: formatCurrency(incomesTotal),
      expensesTotal: formatCurrency(expensesTotal),
      remaining: formatCurrency(incomesTotal - expensesTotal),
    };
  };
