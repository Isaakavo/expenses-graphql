import { GraphQLError } from 'graphql';
import { MutationResolvers } from '../generated/graphql.js';
import { ExpenseTags } from '../models/expense-tags.js';
import { Expense } from '../models/expense.js';
import { Income } from '../models/income.js';
import { Tag } from '../models/tag.js';
import { Date } from '../scalars/date.js';
import { calculateFortnight } from '../utils/calculate-fortnight.js';
//TODO add mutation for deletion
const mutations: MutationResolvers = {
  createIncome: async (_, input, context) => {
    const { total, createdAt, paymentDate } = input;
    const { user } = context;
    const { userId } = await user();

    const parsedPaymentDay = Date.parseValue(paymentDate);
    const parsedCreatedAt = Date.parseValue(createdAt);

    const newIncome = await Income.create({
      userId,
      total,
      paymentDate: parsedPaymentDay,
      createdAt: parsedCreatedAt,
    });

    return {
      userId: newIncome.userId,
      total: newIncome.total,
      paymentDate: {
        date: newIncome.paymentDate,
        forthnight: calculateFortnight(parsedPaymentDay),
      },
      createdAt: newIncome.createdAt,
    };
  },
  createExpense: async (_, input, context) => {
    const { concept, createdAt, total, tags, comment, payBefore } = input;
    const { user } = context;
    const { userId } = await user();

    if (tags.length > 10) {
      throw new GraphQLError('No more than 10 tags per expense', {
        extensions: {
          code: 'BAD REQUEST',
          http: { status: 400 },
        },
      });
    }

    const parsedDate = Date.parseValue(createdAt);
    const parsedPayBefore = Date.parseValue(payBefore);

    const newExpense = await Expense.create({
      userId,
      concept,
      total,
      comments: comment,
      payBefore: parsedPayBefore,
      createdAt: parsedDate,
      updatedAt: parsedDate,
    });

    const newTags = await Promise.all(
      tags.map(async (tag) => {
        const [tagFindOrCreate, created] = await Tag.findOrCreate({
          where: { name: tag.name },
        });

        if (created) {
          console.log(`Find this tag ${tagFindOrCreate.name}`);
        }

        await ExpenseTags.create({
          expenseId: newExpense.id,
          tagId: tagFindOrCreate.id,
        });

        return tagFindOrCreate;
      })
    );

    return {
      id: newExpense.id.toString(),
      userId: newExpense.userId,
      concept: newExpense.concept,
      total: newExpense.total,
      comment: newExpense.comments,
      payBefore: newExpense.payBefore,
      createdAt: newExpense.createdAt,
      updatedAt: newExpense.updatedAt,
      tags: newTags.map((tag) => {
        return {
          id: tag.id.toString(),
          name: tag.name,
          createdAt: tag.createdAt,
          updatedAt: tag.updatedAt,
        };
      }),
    };
  },
};

export default mutations;
