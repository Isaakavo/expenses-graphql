import { WhereOptions } from 'sequelize';
import { adaptExpensesWithCard } from '../adapters/income-adapter.js';
import { Card } from '../models/card.js';
import { Expense } from '../models/expense.js';
import { Income } from '../models/income.js';
import { logger } from '../logger.js';

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

        return adaptExpensesWithCard(expense, expensesCard);
      })
    );
  } catch (error) {
    logger.error(`Error finding cards and tags ${error.message}`);
  }
};

export const encodeCursor = (date: Date): string => {
  return Buffer.from(date.toISOString()).toString('base64')
}

export const decodeCursor = (cursor: string): Date => {
  return new Date(Buffer.from(cursor, 'base64').toString('utf8'))
}
