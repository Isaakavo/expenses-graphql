import {
  Income as GraphqlIncome,
  Expense as GraphqlExpense,
} from '../generated/graphql.js';
import { Income } from '../models/income';
import { calculateFortnight } from '../utils/date-utils.js';
import { Expense } from '../models/expense';
import { Card } from 'models/card';
import { logger } from '../logger.js';
import { Category } from 'models/category.js';

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

export function adaptExpensesWithCard(
  x: Expense,
  card?: Card,
  category?: Category
): GraphqlExpense {
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
      category: adaptCategory(category),
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

export function adaptCategory(category: Category) {
  try {
    return {
      id: category.id,
      name: category.name,
    };
  } catch (error) {
    logger.error(error);
  }
}
