import { Card } from 'models/card';
import {
  Expense as GraphqlExpense,
  Income as GraphqlIncome,
} from '../generated/graphql.js';
import { logger } from '../logger.js';
import { Expense, ExpenseWithCategory } from '../models/expense';
import { Income } from '../models/income';
import { calculateFortnight } from '../utils/date-utils.js';
import { Period } from 'models/periods.js';
import { formatInTimeZone } from 'date-fns-tz';

export function adaptSingleIncome(x: Income): GraphqlIncome {
  return {
    id: x.id,
    userId: x.userId,
    total: formatCurrency(x.total),
    comment: x.comment,
    period: x.period,
    paymentDate: {
      date: formatInTimeZone(x.paymentDate, 'UTC', 'dd MMMM'),
      fortnight: calculateFortnight(x.paymentDate),
    },
    createdAt: x.createdAt,
    updatedAt: x.updatedAt,
  };
}

export function adaptIncome(
  x: Income | { income: Income; period: Period }
): GraphqlIncome {
  // If x has an 'income' property, it's the object form
  const income = 'income' in x ? x.income : x;
  const period = 'period' in x ? x.period : income.period;

  return {
    id: income.id,
    userId: income.userId,
    total: formatCurrency(income.total),
    comment: income.comment,
    period,
    paymentDate: {
      date: formatInTimeZone(income.paymentDate, 'UTC', 'dd MMMM'),
      fortnight: calculateFortnight(income.paymentDate),
    },
    createdAt: income.createdAt,
    updatedAt: income.updatedAt,
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
      total: formatCurrency(x.total),
      userId: x.userId,
      comment: x.comments,
      createdAt: x.createdAt,
      updatedAt: x.updatedAt,
      card: card ? adaptCard(card) : null,
      category: {
        id: '',
        name: '',
        userId: '',
      },
      subCategory: {
        id: '',
        name: '',
        userId: '',
      },
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
      total: formatCurrency(x.total),
      userId: x.userId,
      periodId: x.periodId,
      comment: x.comments,
      createdAt: x.createdAt,
      updatedAt: x.updatedAt,
      card: expenseWithCategory.card
        ? adaptCard(expenseWithCategory.card)
        : null,
      category: {
        id: expenseWithCategory.sub_category.category.id,
        name: expenseWithCategory.sub_category.category.name,
        userId: expenseWithCategory.sub_category.category.userId,
      },
      subCategory: {
        id: expenseWithCategory.sub_category.id,
        name: expenseWithCategory.sub_category.name,
        userId: expenseWithCategory.sub_category.userId,
      },
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

export const formatCurrency = (amount: number) => {
  const formatter = new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
  });

  return formatter.format(amount);
};
