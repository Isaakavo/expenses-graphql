import { ExpensesService } from '../../../service/expenses-service.js';
import { adaptExpensesDTOInput } from '../../../adapters/income-adapter.js';
import { MutationResolvers } from '../../../generated/graphql.js';

export const updateExpense: MutationResolvers['updateExpense'] = async (
  _,
  { input },
  context
) => {
  const {
    user: { userId },
  } = context;
  const { subCategoryId, concept, id, payBefore, total, cardId, comment } = input;
  const expenseService = new ExpensesService(userId, context.sequelizeClient);

  const updatedExpense = await expenseService.updateExpense(id, {
    total,
    cardId,
    comments: comment,
    concept,
    subCategoryId,
    payBefore,
    // Omitted keeps the link, null unlinks
    ...('goalId' in input && { goalId: input.goalId }),
    ...('goalRole' in input && { goalRole: input.goalRole }),
    ...('foreignAmount' in input && { foreignAmount: input.foreignAmount }),
  });

  return adaptExpensesDTOInput(updatedExpense);
};
