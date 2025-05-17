import { QueryResolvers } from '../../../generated/graphql.js';
import { findAllExpensesWithCards } from '../../../utils/expenses-utils.js';
import { whereByFornight } from '../../../utils/where-fortnight.js';

export const expensesByFortnight: QueryResolvers['expensesByFortnight'] =
  async (_, { input }, context) => {
    const { payBefore, cardId } = input;
    const {
      user: { userId },
    } = context;

    // TODO refactor this to handle undfined value un function whereByFornight
    const where = !cardId
      ? whereByFornight(userId, payBefore, 'payBefore')
      : whereByFornight(userId, payBefore, 'payBefore', { cardId });

    const expenses = await findAllExpensesWithCards(where);

    const expensesTotal = expenses.reduce(
      (acumulator, currentValue) => acumulator + currentValue.total,
      0
    );

    return {
      expenses,
      expensesTotal,
    };
  };
