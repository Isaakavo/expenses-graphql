import { adaptExpensesByCategoryDTO } from '../../../adapters/expense-adapter.js';
import { QueryResolvers } from '../../../generated/graphql.js';
import { ExpensesService } from '../../../service/expenses-service.js';

export const expensesByCategory: QueryResolvers['expensesByCategory'] = async (
  _,
  { input },
  context
) => {
  const {
    user: { userId },
    sequelizeClient,
  } = context;

  const { periodId, startDate, endDate, subCategoryIds, cardId } = input;

  const service = new ExpensesService(userId, sequelizeClient);

  const expenses = await service.getExpensesByCategory(
    periodId,
    startDate,
    endDate,
    subCategoryIds,
    cardId
  );

  return adaptExpensesByCategoryDTO(expenses);
};
