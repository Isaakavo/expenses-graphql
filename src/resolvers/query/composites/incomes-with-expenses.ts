import { ExpensesService } from '../../../service/expenses-service.js';
import { QueryResolvers } from '../../../generated/graphql.js';
import { IncomeService } from '../../../service/income-service.js';

export const incomesWithExpenses: QueryResolvers['incomesWithExpenses'] =
  async (_, { input }, context) => {
    const {
      user: { userId },
    } = context;

    const { startDate, endDate, periodId } = input;

    const incomesService = new IncomeService(userId);
    const expensesService = new ExpensesService(userId);    

    const incomes = await incomesService.getIncomeByPeriod(
      periodId,
      startDate,
      endDate
    );
    const expenses = await expensesService.getExpensesByPeriod(
      periodId,
      startDate,
      endDate
    );

    const incomesTotal = incomes.reduce((acc, income) => acc + income.total, 0);
    const expensesTotal = expenses.reduce(
      (acc, expense) => acc + expense.total,
      0
    );

    return {
      incomes,
      expenses,
      incomesTotal,
      expensesTotal,
      remaining: incomesTotal - expensesTotal,
    };
  };
