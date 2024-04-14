import { WhereOptions } from 'sequelize';
import { adaptExpensesWithCard } from '../adapters/income-adapter.js';
import { Card } from '../models/card.js';
import { Expense } from '../models/expense.js';
import { Income } from '../models/income.js';
import { logger } from '../logger.js';
import { Category } from '../models/category.js';

export const findIncomeByIdWithExpenses = async (
  incomeExpenses: WhereOptions = {}
) => {
  return await Income.findAll({
    where: incomeExpenses,
  });
};

export const findAllExpensesWithCards = async (where: WhereOptions = {}) => {
  const allExpenses = await Expense.findAll({
    where,
    order: [['payBefore', 'DESC']],
  });

  return await findCard(allExpenses);
};

export const findCard = async (expenses: Expense[]) => {
  try {
    return await Promise.all(
      expenses.map(async (expense) => {
        const expensesCard = await Card.findOne({
          where: {
            id: expense.cardId,
            userId: expense.userId,
          },
        });

        const categories = await findCategory(expense);

        return adaptExpensesWithCard(expense, expensesCard, categories);
      })
    );
  } catch (error) {
    logger.error(`Error finding cards and tags ${error.message}`);
  }
};

export const findCategory = async (expense: Expense) => {
  try {
    return await Category.findOne({
      where: {
        id: expense.categoryId,
      },
    });
  } catch (error) {
    logger.error(`Error finding categories ${error.message}`);
  }
};
