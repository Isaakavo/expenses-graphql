import { MutationResolvers } from 'generated/graphql';
import { Date } from '../scalars/date.js';
import { Tag } from '../models/tag.js';
import { Expense } from '../models/expense.js';
import { ExpenseTags } from '../models/expense-tags.js';

const mutations: MutationResolvers = {
  createIncome: async (_, input, context) => {
    const { total, createdAt, paymentDate } = input;

    return {
      total: total,
      createdAt: Date.parseValue(createdAt),
      paymentDate: Date.parseValue(paymentDate),
    };
  },
  // TODO add the user id to every element in the table
  createExpense: async (_, input, context) => {
    const { concept, createdAt, total, tags, comment } = input;

    const parsedDate = Date.parseValue(createdAt);

    const newExpense = await Expense.create({
      concept,
      total,
      comments: comment,
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
      concept: newExpense.concept,
      total: newExpense.total,
      comment: newExpense.comments,
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
