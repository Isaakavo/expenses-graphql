import {
  calculateFortnight,
  fifteenthDayOfMonth,
} from '../utils/calculate-fortnight.js';
import { Fortnight, QueryResolvers } from '../generated/graphql.js';
import { ExpenseTags } from '../models/expense-tags.js';
import { Expense } from '../models/expense.js';
import { Income } from '../models/income.js';
import { Tag } from '../models/tag.js';
import { Op, WhereAttributeHashValue } from 'sequelize';
import { Date } from '../scalars/date.js';
import { endOfMonth, startOfMonth } from 'date-fns';

const queries: QueryResolvers = {
  expenses: async (_, input, context) => {
    const { payBefore } = input;
    const { user } = context;
    const { userId } = await user();

    const parsedBeforeDate = Date.parseValue(payBefore);
    const fortnight = calculateFortnight(parsedBeforeDate);
    const whereStatement: WhereAttributeHashValue<Date> =
      fortnight === Fortnight.First
        ? {
            [Op.gte]: startOfMonth(parsedBeforeDate),
            [Op.lte]: fifteenthDayOfMonth(parsedBeforeDate),
          }
        : {
            [Op.gte]: fifteenthDayOfMonth(parsedBeforeDate),
            [Op.lte]: endOfMonth(parsedBeforeDate),
          };

    const allExpenses = await Expense.findAll({
      where: {
        userId,
        payBefore: whereStatement,
      },
    });

    const result = await Promise.all(
      allExpenses.map(async (expense) => {
        const expensesTags = await ExpenseTags.findAll({
          where: {
            expenseId: expense.id,
          },
        });

        const tags = await Promise.all(
          expensesTags.map(async (expenseTag) => {
            return await Tag.findOne({ where: { id: expenseTag.tagId } });
          })
        );

        return {
          id: expense.id.toString(),
          userId: expense.userId,
          concept: expense.concept,
          total: expense.total,
          comment: expense.comments,
          payBefore: expense.payBefore,
          createdAt: expense.createdAt,
          updatedAt: expense.updatedAt,
          tags: tags.map((tag) => {
            return {
              id: tag.id.toString(),
              name: tag.name,
              createdAt: tag.createdAt,
              updatedAt: tag.updatedAt,
            };
          }),
        };
      })
    );

    return result;
  },
  incomes: async (_, __, context) => {
    const { user } = context;
    const { userId } = await user();

    const allIncomes = await Income.findAll({
      where: {
        userId,
      },
    });

    const response = allIncomes.map((x) => ({
      userId: x.userId,
      total: x.total,
      paymentDate: {
        date: x.paymentDate,
        forthnight: calculateFortnight(x.paymentDate),
      },
      createdAt: x.createdAt,
    }));

    return response;
  },
};

export default queries;
