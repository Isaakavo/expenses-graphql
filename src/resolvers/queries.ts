import { format } from 'date-fns';
import { IncomeTotalByMonth, QueryResolvers } from '../generated/graphql.js';
import { Income } from '../models/income.js';
import { Tag } from '../models/tag.js';
import { calculateFortnight } from '../utils/calculate-fortnight.js';
import { findAllExpensesWithTags } from '../utils/expenses-find.js';
import { whereByFornight, whereByMonth } from '../utils/where-fortnight.js';

const queries: QueryResolvers = {
  allExpenses: async (_, __, context) => {
    const { user } = context;
    const { userId } = await user();

    return findAllExpensesWithTags({ userId });
  },
  expensesByFortnight: async (_, input, context) => {
    const { payBefore } = input;
    const { user } = context;
    const { userId } = await user();

    const where = whereByFornight(userId, payBefore, 'payBefore');

    return findAllExpensesWithTags(where);
  },
  expensesByMonth: async (_, input, context) => {
    const { date } = input;
    const { user } = context;
    const { userId } = await user();

    const where = whereByMonth(userId, date, 'payBefore');

    return findAllExpensesWithTags(where);
  },
  // TODO add logic to return a new field called creditCardDebts
  // if the expense contains tag "tarjeta de credito" those totals should be add
  // to this new field.
  financialBalanceByFortnight: async (_, input, context) => {
    const { payBefore } = input;
    const { user } = context;
    const { userId } = await user();

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
  incomes: async (_, __, context) => {
    const { user } = context;
    const { userId } = await user();

    const allIncomes = await Income.findAll({
      where: {
        userId,
      },
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

    return {
      incomes: allIncomes.map((x) => ({
        userId: x.userId,
        total: x.total,
        paymentDate: {
          date: x.paymentDate,
          forthnight: calculateFortnight(x.paymentDate),
        },
        createdAt: x.createdAt,
      })),
      totalByMonth: result,
      total: sumOfAll,
    };
  },
  incomesByMonth: async (_, input, context) => {
    const { date } = input;
    const { user } = context;
    const { userId } = await user();

    const where = whereByMonth(userId, date, 'paymentDate');

    const allIncomes = await Income.findAll({ where });

    return allIncomes.map((x) => ({
      userId: x.userId,
      total: x.total,
      paymentDate: {
        date: x.paymentDate,
        forthnight: calculateFortnight(x.paymentDate),
      },
      createdAt: x.createdAt,
    }));
  },
  tags: async (_, __, ___) => {
    const tags = await Tag.findAll();

    return tags.map((x) => ({
      id: x.id.toString(),
      name: x.name,
      createdAt: x.createdAt,
      updatedAt: x.updatedAt,
    }));
  },
};

export default queries;
