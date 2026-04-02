import { adaptExpensesDTOInput } from '../../../adapters/income-adapter.js';
import { MutationResolvers } from '../../../generated/graphql.js';
import { ExpensesService } from '../../../service/expenses-service.js';
import { Date as CustomDate } from '../../../scalars/date.js';

export const createFixedExpense: MutationResolvers['createFixedExpense'] =
  async (_, { input }, { user: { userId }, sequelizeClient }) => {
    const expenseService = new ExpensesService(userId, sequelizeClient);

    const expenses = await expenseService.createFixedExpenses({
      concept: input.concept,
      total: input.total,
      cardId: input.cardId,
      payBefore: CustomDate.parseValue(input.payBefore),
      comment: input.comment,
      categoryId: input.categoryId,
      subCategoryId: input.subCategoryId,
      numberOfRepetitions: input.numberOfRepetitions,
      frequency: input.frequency,
    });

    return expenses.map((expense) => adaptExpensesDTOInput(expense));
  };
