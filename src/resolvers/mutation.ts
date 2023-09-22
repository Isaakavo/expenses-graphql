import { Fortnight, MutationResolvers } from '../generated/graphql.js';
import { Date } from '../scalars/date.js';
import { Tag } from '../models/tag.js';
import { Expense } from '../models/expense.js';
import { ExpenseTags } from '../models/expense-tags.js';
import { Income } from '../models/income.js';
import { calculateFortnight } from '../utils/calculate-fortnight.js';

const mutations: MutationResolvers = {
  createIncome: async (_, input, context) => {
    const { total, createdAt, paymentDate } = input;
    const { user } = context;
    const { userId } = await user();

    const parsedPaymentDay = Date.parseValue(paymentDate);
    const parsedCreatedAt = Date.parseValue(createdAt);

    console.log(parsedPaymentDay);

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
        // await Tag.create({ name: tag.name, expenseId: newExpense.id });
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

    console.log({ id: newExpense.id, tags: newTags });
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
