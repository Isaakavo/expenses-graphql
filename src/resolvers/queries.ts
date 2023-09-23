import { endOfMonth, startOfMonth } from 'date-fns';
import { Op } from 'sequelize';
import { Fortnight, QueryResolvers } from '../generated/graphql.js';
import { Income } from '../models/income.js';
import { Tag } from '../models/tag.js';
import { Date } from '../scalars/date.js';
import {
  calculateFortnight,
  fifteenthDayOfMonth,
} from '../utils/calculate-fortnight.js';
import { findAllExpensesWithTags } from '../utils/expenses-find.js';

const queries: QueryResolvers = {
  allExpenses: async (_, __, context) => {
    const { user } = context;
    const { userId } = await user();

    return findAllExpensesWithTags({ userId });
  },
  expensesByDate: async (_, input, context) => {
    const { payBefore } = input;
    const { user } = context;
    const { userId } = await user();

    const parsedBeforeDate = Date.parseValue(payBefore);
    const fortnight = calculateFortnight(parsedBeforeDate);
    const where = {
      userId,
      payBefore:
        fortnight === Fortnight.First
          ? {
              [Op.gte]: startOfMonth(parsedBeforeDate),
              [Op.lte]: fifteenthDayOfMonth(parsedBeforeDate),
            }
          : {
              [Op.gte]: fifteenthDayOfMonth(parsedBeforeDate),
              [Op.lte]: endOfMonth(parsedBeforeDate),
            },
    };

    return findAllExpensesWithTags(where);
  },
  incomes: async (_, __, context) => {
    const { user } = context;
    const { userId } = await user();

    const allIncomes = await Income.findAll({
      where: {
        userId,
      },
    });

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
