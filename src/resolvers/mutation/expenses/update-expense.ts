import { ExpensesService } from '../../../service/expenses-service.js';
import { ExpenseUpdate } from '../../../service/recurrence-service.js';
import { adaptExpensesDTOInput } from '../../../adapters/income-adapter.js';
import { MutationResolvers, UpdateExpenseInput } from '../../../generated/graphql.js';

export const toExpenseUpdate = (input: UpdateExpenseInput): ExpenseUpdate => ({
  total: input.total,
  cardId: input.cardId,
  comments: input.comment,
  concept: input.concept,
  subCategoryId: input.subCategoryId,
  payBefore: input.payBefore,
  // Omitted keeps the link, null unlinks
  ...('goalId' in input && { goalId: input.goalId }),
  ...('goalRole' in input && { goalRole: input.goalRole }),
  ...('foreignAmount' in input && { foreignAmount: input.foreignAmount }),
});

export const updateExpense: MutationResolvers['updateExpense'] = async (
  _,
  { input },
  context
) => {
  const {
    user: { userId },
  } = context;
  const expenseService = new ExpensesService(userId, context.sequelizeClient);

  const updatedExpense = await expenseService.updateExpense(input.id, toExpenseUpdate(input));

  return adaptExpensesDTOInput(updatedExpense);
};
