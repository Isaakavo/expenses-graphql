import { WhereOptions } from 'sequelize';
import { adaptExpensesWithTagsAndCard } from '../adapters/income-adapter.js';
import { Card } from '../models/card.js';
import { ExpenseTags } from '../models/expense-tags.js';
import { Expense } from '../models/expense.js';
import { Income } from '../models/income.js';
import { Tag } from '../models/tag.js';
import { logger } from '../logger.js';

export const findIncomeByIdWithExpenses = async (
  incomeExpenses: WhereOptions = {}
) => {
  return await Income.findAll({
    where: incomeExpenses,
  });
};

export const findAllExpensesWithTagsAndCards = async (
  where: WhereOptions = {}
) => {
  const allExpenses = await Expense.findAll({
    where,
    order: [['payBefore', 'DESC']]
  });

  return await findTagsAndCard(allExpenses);
};

export const findTagsAndCard = async (expenses: Expense[]) => {
  try {
    return await Promise.all(
      expenses.map(async (expense) => {
        const expensesTags = await ExpenseTags.findAll({
          where: {
            expenseId: expense.id,
          },
        });

        const expensesCard = await Card.findOne({
          where: {
            id: expense.cardId,
            userId: expense.userId,
          },
        });

        const tags = await Promise.all(
          expensesTags.map(async (expenseTag) => {
            return await Tag.findOne({ where: { id: expenseTag.tagId } });
          })
        );

        return adaptExpensesWithTagsAndCard(expense, tags, expensesCard);
      })
    );
  } catch (error) {
    logger.error(`Error finding cards and tags ${error.message}`);
  }
};
