import { adaptMultipleIncomes } from '../../../adapters/index.js';
import { logger } from '../../../logger.js';
import {
  findAllExpensesWithCards,
  findIncomeByIdWithExpenses,
} from '../../../utils/expenses-utils.js';
import { whereByFornight } from '../../../utils/where-fortnight.js';

export const incomesAndExpensesByFortnight = async (_, { input }, context) => {
  try {
    const { payBefore } = input;
    const {
      user: { userId },
    } = context;

    logger.info(payBefore);

    const payBeforeWhere = whereByFornight(userId, payBefore, 'payBefore');

    const incomesWithExpenses = await findIncomeByIdWithExpenses(
      whereByFornight(userId, payBefore, 'paymentDate')
    );

    const expenses = await findAllExpensesWithCards(payBeforeWhere);

    const incomesTotal = incomesWithExpenses.reduce(
      (acc, current) => acc + current.total,
      0
    );

    const expensesTotal = expenses.reduce(
      (acumulator, currentValue) => acumulator + currentValue.total,
      0
    );

    logger.info(`Returning ${expenses.length} expenses for incomes`);

    return {
      incomes: adaptMultipleIncomes(incomesWithExpenses),
      incomesTotal,
      expenses: expenses,
      expensesTotal,
      remaining: incomesTotal - expensesTotal,
    };
  } catch (error) {
    logger.error(`Error quering incomeAndExpensesByFornight ${error.message}`);
  }
};
