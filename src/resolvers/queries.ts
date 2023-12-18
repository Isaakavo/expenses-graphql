import { GraphQLError } from 'graphql';
import { adaptCard, adaptMultipleIncomes } from '../adapters/income-adapter.js';
import {
  Expense,
  QueryResolvers,
  TotalByFortnight,
} from '../generated/graphql.js';
import { logger } from '../logger.js';
import { Card } from '../models/card.js';
import { Income } from '../models/income.js';
import { calculateFortnight } from '../utils/calculate-fortnight.js';
import {
  calcualteTotalByMonth,
  calculateTotalByFortnight,
} from '../utils/calculate-total.js';
import {
  findAllExpensesWithCards,
  findIncomeByIdWithExpenses,
} from '../utils/expenses-find.js';
import { whereByFornight, whereByMonth } from '../utils/where-fortnight.js';

const queries: QueryResolvers = {
  allExpenses: async (_, __, context) => {
    const {
      user: { userId },
    } = context;

    return findAllExpensesWithCards({ userId });
  },
  expensesByFortnight: async (_, { input }, context) => {
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
  },
  expensesByMonth: async (_, { input }, context) => {
    const { payBefore, cardId } = input;
    const {
      user: { userId },
    } = context;

    const where = !cardId
      ? whereByMonth(userId, payBefore, 'payBefore')
      : whereByMonth(userId, payBefore, 'payBefore', { cardId });

    const expenses = await findAllExpensesWithCards(where);
    const expensesTotal = expenses.reduce(
      (acumulator, currentValue) => acumulator + currentValue.total,
      0
    );

    return {
      expenses,
      expensesTotal,
    };
  },
  incomesAndExpensesByFortnight: async (_, { input }, context) => {
    try {
      const { payBefore } = input;
      const {
        user: { userId },
      } = context;

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
      logger.error(
        `Error quering incomeAndExpensesByFornight ${error.message}`
      );
    }
  },
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
  incomesList: async (_, __, context) => {
    try {
      const {
        user: { userId },
      } = context;

      //TODO implement logic in the query to receive the order of filtering from the client
      const allIncomes = await Income.findAll({
        where: {
          userId,
        },
        order: [['paymentDate', 'DESC']],
      });

      logger.info(`returning ${allIncomes.length} incomes`);

      return {
        incomes: allIncomes.map((x) => ({
          id: x.id.toString(),
          userId: x.userId,
          total: x.total,
          comment: x.comment,
          paymentDate: {
            date: x.paymentDate,
            fortnight: calculateFortnight(x.paymentDate),
          },
          createdAt: x.createdAt,
        })),
        totalByMonth: calcualteTotalByMonth(allIncomes),
        total: allIncomes.reduce(
          (acumulator, currentValue) => acumulator + currentValue.total,
          0
        ),
      };
    } catch (error) {
      if (error instanceof GraphQLError) {
        logger.error(`Graphql Error incomes list ${error.message}`);
        throw error;
      }
      logger.error(`Error incomes list ${error}`);
    }
  },
  incomesByMonth: async (_, input, context) => {
    const { date } = input;
    const {
      user: { userId },
    } = context;

    const where = whereByMonth(userId, date, 'paymentDate');

    const allIncomes = await Income.findAll({ where });

    return allIncomes.map((x) => ({
      id: x.id.toString(),
      userId: x.userId,
      total: x.total,
      paymentDate: {
        date: x.paymentDate,
        fortnight: calculateFortnight(x.paymentDate),
      },
      createdAt: x.createdAt,
    }));
  },
  cardList: async (_, input, context) => {
    const {
      user: { userId },
    } = context;

    const allCards = await Card.findAll({
      where: {
        userId,
      },
    });

    logger.info(`returning cards ${allCards}`);

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

    // const payBeforeWhere = whereByFornight(userId, payBefore, 'payBefore');
    const expenses = await findAllExpensesWithCards({ userId, cardId });
    const totalByMonth = calcualteTotalByMonth(expenses);
    const totalByFortnight = calculateTotalByFortnight<
      Expense,
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
