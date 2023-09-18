import { Date } from '../scalars/date.js';
import { QueryResolvers } from '../generated/graphql';
import { Expense } from '../models/expense.js';
import { ExpenseTags } from '../models/expense-tags.js';
import { Tag } from '../models/tag.js';

const queries: QueryResolvers = {
  expenses: async (_, __, context) => {
    const { user } = context;
    // const  {username}  = await user();
    //console.log({username});

    const allExpenses = await Expense.findAll();

    const result = await Promise.all(
      allExpenses.map(async (expense) => {
        const expensesTags = await ExpenseTags.findAll({
          where: { expenseId: expense.id },
        });

        const tags = await Promise.all(
          expensesTags.map(async (expenseTag) => {
            return await Tag.findOne({ where: { id: expenseTag.tagId } });
          })
        );

        return {
          id: expense.id.toString(),
          concept: expense.concept,
          total: expense.total,
          comment: expense.comments,
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

    console.log({ allExpenses, result });

    return result;
  },
};

export default queries;
