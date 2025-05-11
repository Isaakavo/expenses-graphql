import { GraphQLError } from 'graphql';
import {
  adaptCard
} from '../adapters/income-adapter.js';
import {
  Expense as GraphqlExpense,
  QueryResolvers,
  TotalByFortnight,
} from '../generated/graphql.js';
import { logger } from '../logger.js';
import { Card } from '../models/card.js';
import { Income } from '../models/income.js';
import {
  calcualteTotalByMonth,
  calculateTotalByFortnight,
} from '../utils/calculate-total.js';
import {
  findAllExpensesWithCards,
} from '../utils/expenses-utils.js';
import { whereByFornight } from '../utils/where-fortnight.js';
import { incomeById } from './query/income/income-by-id.js';
import { incomesByMonth } from './query/income/incomes-by-month.js';
import {
  allExpenses,
  allExpensesByDateRange,
  expenseById,
  expensesByFortnight,
  expensesByMonth,
  incomesAndExpensesByFortnight,
  incomesList,
} from './query/index.js';

const queries: QueryResolvers = {
  allExpenses,
  allExpensesByDateRange,
  expensesByFortnight,
  expensesByMonth,
  expenseById,
  incomesAndExpensesByFortnight,
  // TODO add logic to return a new field called creditCardDebts
  // if the expense contains tag "tarjeta de credito" those totals should be added
  // to this new field.
  financialBalanceByFortnight: async (_, { input }, context) => {
    const { payBefore } = input;
    const {
      user: { userId },
    } = context;

    const whereExpenses = whereByFornight(userId, payBefore, 'payBefore');
    const whereIncome = whereByFornight(userId, payBefore, 'paymentDate');

    const allExpenses = findAllExpensesWithCards(whereExpenses);
    const income = await Income.findOne({ where: whereIncome });

    const debts = Number(
      (await allExpenses)
        .reduce(
          (accumulator, currentValue) => accumulator + currentValue.total,
          0
        )
        .toFixed(2)
    );

    const remaining = Number((income.total - debts).toFixed(2));

    return {
      debts,
      remaining,
    };
  },
  incomesList,
  incomeById,
  incomesByMonth,
  cardList: async (_, input, context) => {
    const {
      user: { userId },
    } = context;

    const allCards = await Card.findAll({
      where: {
        userId,
      },
    });

    logger.info(`returning ${allCards.length} cards`);

    return allCards.map((card) => {
      return adaptCard(card);
    });
  },
  cardById: async (_, input, context) => {
    const { cardId } = input;
    const {
      user: { userId },
    } = context;

    const card = await Card.findOne({
      where: {
        id: cardId,
        userId,
      },
    });

    if (!card) {
      throw new GraphQLError('The card id doesnt exists');
    }

    return adaptCard(card);
  },
  expensesTotalByCardId: async (_, { cardId }, context) => {
    const {
      user: { userId },
    } = context;

    const expenses = await findAllExpensesWithCards({ userId, cardId });
    const totalByMonth = calcualteTotalByMonth(expenses);
    const totalByFortnight = calculateTotalByFortnight<
      GraphqlExpense,
      TotalByFortnight
    >(expenses);

    logger.info(`Returning information for card ${cardId}`);
    return {
      totalByMonth,
      totalByFortnight,
    };
  },
};

export default queries;
