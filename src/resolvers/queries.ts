import { GraphQLError } from 'graphql';
import { Op, WhereOptions } from 'sequelize';
import {
  adaptCard,
  adaptExpensesWithCard,
  adaptMultipleIncomes,
  adaptSingleIncome,
} from '../adapters/income-adapter.js';
import {
  Expense as GraphqlExpense,
  QueryResolvers,
  TotalByFortnight,
} from '../generated/graphql.js';
import { logger } from '../logger.js';
import { Card } from '../models/card.js';
import { Expense } from '../models/expense.js';
import { Income } from '../models/income.js';
import {
  calcualteTotalByMonth,
  calculateTotalByFortnight,
} from '../utils/calculate-total.js';
import { calculateFortnight } from '../utils/date-utils.js';
import {
  decodeCursor,
  encodeCursor,
  // decodeCursor,
  findAllExpensesWithCards,
  findIncomeByIdWithExpenses,
} from '../utils/expenses-utils.js';
import { validateId } from '../utils/sequilize-utils.js';
import { whereByFornight, whereByMonth } from '../utils/where-fortnight.js';
import { ExpensesService } from '../service/expenses-service.js';

const expenseRepository = new ExpensesService();

const queries: QueryResolvers = {
  allExpenses: async (_, { first, after }, context) => {
    const {
      user: { userId },
    } = context;

    console.log(decodeCursor(after));
    

    const whereClause: WhereOptions = after
      ? { createdAt: { [Op.gt]: decodeCursor(after) } }
      : {};

    const expensesPaginatedList = await expenseRepository.getAllExpenses(
      userId,
      {
        where: whereClause,
        limit: first,
      }
    );

    const edges = expensesPaginatedList.map((exp) => ({
      node: exp,
      cursor: encodeCursor(exp.createdAt),
    }));

    const endCursor = edges.length ? edges[edges.length - 1].cursor : null;

    // Verificamos si hay más resultados con un fetch adicional
    let hasNextPage = false;
    if (edges.length === first) {
      const lastCreatedAt =
        expensesPaginatedList[expensesPaginatedList.length - 1].createdAt;
      const nextExpense = await Expense.findOne({
        where: { createdAt: { [Op.gt]: lastCreatedAt } },
        order: [['createdAt', 'ASC']],
      });
      hasNextPage = !!nextExpense;
    }

    return {
      edges,
      pageInfo: {
        endCursor,
        hasNextPage,
      },
    };
  },
  allExpensesByDateRange: async (_, { input }, context) => {
    const {
      user: { userId },
    } = context;
    const { endDate, initialDate } = input;

    const parsedEndDate = new Date(endDate.year, endDate.month, endDate.day);
    const parsedStartDate = new Date(
      initialDate.year,
      initialDate.month,
      initialDate.day
    );

    if (parsedEndDate < parsedStartDate) {
      logger.error('end date must be ahead of start date');
      throw new GraphQLError('Wrong dates');
    }

    logger.info(`Start date: ${parsedStartDate} End date: ${parsedEndDate}`);
    return findAllExpensesWithCards({
      userId,
      payBefore: { [Op.gte]: parsedStartDate, [Op.lte]: parsedEndDate },
    });
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

    logger.info(`Returning ${expenses.length} expenses`);

    return {
      expenses,
      expensesTotal,
    };
  },
  expenseById: async (_, { id }, context) => {
    const {
      user: { userId },
    } = context;

    const expense = (await validateId(Expense, userId, id)) as Expense;

    const card = await Card.findOne({
      where: {
        userId,
        id: expense.cardId,
      },
    });

    return adaptExpensesWithCard(expense, card);
  },
  incomesAndExpensesByFortnight: async (_, { input }, context) => {
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
        incomes: allIncomes.map((x) => adaptSingleIncome(x)),
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
  incomeById: async (_, { incomeId }, context) => {
    try {
      const {
        user: { userId },
      } = context;

      const income = await Income.findOne({
        where: {
          userId,
          id: incomeId,
        },
      });

      return adaptSingleIncome(income);
    } catch (error) {
      logger.error(error);
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
