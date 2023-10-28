import { format } from 'date-fns';
import { GraphQLError } from 'graphql';
import {
  adaptCard,
  adaptMultipleIncomes,
  adaptSingleIncome,
  adaptTag,
} from '../adapters/income-adapter.js';
import {
  Fortnight,
  IncomeTotalByMonth,
  QueryResolvers,
} from '../generated/graphql.js';
import { Income } from '../models/income.js';
import { Tag } from '../models/tag.js';
import { calculateFortnight } from '../utils/calculate-fortnight.js';
import {
  findAllExpensesWithTags,
  findIncomeByIdWithExpenses,
  findTagsAndCard,
} from '../utils/expenses-find.js';
import { whereByFornight, whereByMonth } from '../utils/where-fortnight.js';
import { Card } from '../models/card.js';
import {
  Income as GraphqlIncome,
  Expense as GraphqlExpense,
} from 'generated/graphql';

const queries: QueryResolvers = {
  allExpenses: async (_, __, context) => {
    const {
      user: { userId },
    } = context;

    return findAllExpensesWithTags({ userId });
  },
  expensesByFortnight: async (_, { input }, context) => {
    const { payBefore } = input;
    const {
      user: { userId },
    } = context;

    const where = whereByFornight(userId, payBefore, 'payBefore');

    return findAllExpensesWithTags(where);
  },
  incomeAndExpensesByFortnight: async (_, { input }, context) => {
    try {
      //TODO remove income id from this query input
      const { payBefore } = input;
      const {
        user: { userId },
      } = context;

      const incomesWithExpenses = await findIncomeByIdWithExpenses(
        whereByFornight(userId, payBefore, 'paymentDate'),
        whereByFornight(userId, payBefore, 'payBefore')
      );

      const incomesTotal = incomesWithExpenses.reduce(
        (acc, current) => acc + current.total,
        0
      );

      const exp = await Promise.all(
        incomesWithExpenses.flatMap(
          async (x) => await findTagsAndCard(x.expenses)
        )
      );

      const expensesTotal = incomesWithExpenses
        .map((x) =>
          x.expenses.reduce(
            (acumulator, currentValue) => acumulator + currentValue.total,
            0
          )
        )
        .reduce((acc, current) => acc + current, 0);

      return {
        income: adaptMultipleIncomes(incomesWithExpenses),
        expenses: exp[0],
        expensesTotal,
        remaining: incomesTotal - expensesTotal,
      };
    } catch (error) {
      console.error(error);
    }
  },
  expensesByMonth: async (_, input, context) => {
    const { date } = input;
    const {
      user: { userId },
    } = context;

    const where = whereByMonth(userId, date, 'payBefore');

    return findAllExpensesWithTags(where);
  },
  // TODO add logic to return a new field called creditCardDebts
  // if the expense contains tag "tarjeta de credito" those totals should be add
  // to this new field.
  financialBalanceByFortnight: async (_, { input }, context) => {
    const { payBefore } = input;
    const {
      user: { userId },
    } = context;

    const whereExpenses = whereByFornight(userId, payBefore, 'payBefore');
    const whereIncome = whereByFornight(userId, payBefore, 'paymentDate');

    const allExpenses = findAllExpensesWithTags(whereExpenses);
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

      // TODO improve logic
      const monthMap = {};

      const totalByMonth = allIncomes.map((x) => {
        const formatedMonth = format(x.paymentDate, 'LLLL');
        monthMap[formatedMonth] = (monthMap[formatedMonth] ?? 0) + x.total;

        return {
          date: formatedMonth,
          total: monthMap[formatedMonth],
        };
      });

      const maxTotalByDate = {};

      for (const item of totalByMonth) {
        if (
          !maxTotalByDate[item.date] ||
          item.total > maxTotalByDate[item.date].total
        ) {
          maxTotalByDate[item.date] = item;
        }
      }

      const result = Object.values(maxTotalByDate) as Array<IncomeTotalByMonth>;

      const sumOfAll = allIncomes.reduce(
        (acumulator, currentValue) => acumulator + currentValue.total,
        0
      );

      console.log(`returning ${allIncomes.length} incomes`);

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
        totalByMonth: result,
        total: sumOfAll,
      };
    } catch (error) {
      if (error instanceof GraphQLError) {
        throw error;
      }
      console.error(error);
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
  tags: async (_, __, ___) => {
    const tags = await Tag.findAll();

    return tags.map((x) => adaptTag(x));
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

    console.log(allCards);

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
};

export default queries;
