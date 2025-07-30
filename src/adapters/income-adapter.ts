import { Card } from 'models/card';
import {
  Expense as GraphqlExpense,
  Income as GraphqlIncome,
} from '../generated/graphql.js';
import { logger } from '../logger.js';
import { Expense, ExpenseWithCategory } from '../models/expense';
import { Income } from '../models/income';
import { calculateFortnight } from '../utils/date-utils.js';

export function adaptSingleIncome(x: Income): GraphqlIncome {
  return {
    id: x.id.toString(),
    userId: x.userId,
    total: x.total,
    comment: x.comment,
    paymentDate: {
      date: x.paymentDate,
      fortnight: calculateFortnight(x.paymentDate),
    },
    createdAt: x.createdAt,
    updatedAt: x.updatedAt,
  };
}

export const adaptMultipleIncomes = (incomes: Income[]) =>
  incomes.map((x) => adaptSingleIncome(x));

// TODO refactor this to avoid code duplication
export function adaptExpensesWithCard(x: Expense, card?: Card) {
  try {
    return {
      id: x.id.toString(),
      concept: x.concept,
      payBefore: x.payBefore,
      total: x.total,
      userId: x.userId,
      comment: x.comments,
      createdAt: x.createdAt,
      updatedAt: x.updatedAt,
      card: card ? adaptCard(card) : null,
      category: '',
      subCategory: '',
    };
  } catch (error) {
    logger.error(error);
  }
}

export function adaptExpenses(x: Expense): GraphqlExpense {
  try {
    const expenseWithCategory = x as ExpenseWithCategory;
    return {
      id: x.id.toString(),
      concept: x.concept,
      payBefore: x.payBefore,
      total: x.total,
      userId: x.userId,
      comment: x.comments,
      createdAt: x.createdAt,
      updatedAt: x.updatedAt,
      card: expenseWithCategory.card
        ? adaptCard(expenseWithCategory.card)
        : null,
      category: expenseWithCategory.sub_category.category.name,
      subCategory: expenseWithCategory.sub_category.name,
    };
  } catch (error) {
    logger.error(error);
  }
}

export function adaptCard(card: Card) {
  try {
    return {
      id: card.id.toString(),
      userId: card.userId,
      alias: card.alias,
      bank: card.bank,
      isDigital: card.isDigital,
      isDebit: card.isDebit,
    };
  } catch (error) {
    logger.error(error);
  }
}
