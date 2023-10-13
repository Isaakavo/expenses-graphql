import { ExpenseTags } from '../models/expense-tags.js';
import { Expense } from '../models/expense.js';
import { Tag } from '../models/tag.js';

export const findAllExpensesWithTags = async (where: any | {} = {}) => {
  const allExpenses = await Expense.findAll({
    where,
  });

  return await Promise.all(
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

      console.log(expense.incomeId);
      

      return {
        id: expense.id.toString(),
        incomeId: expense.incomeId.toString(),
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
};
