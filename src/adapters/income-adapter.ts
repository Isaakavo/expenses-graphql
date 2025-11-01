import { formatInTimeZone } from 'date-fns-tz';
import { ExpenseDTO } from 'dto/expense-dto.js';
import {
  IncomeDTO,
  IncomeWithCategoryAllocationDTO,
} from 'dto/income-dto.js';
import { PeriodDTO } from 'dto/period-dto.js';
import { Card } from 'models/card';
import {
  Expense as GraphqlExpense,
  Income as GraphqlIncome,
} from '../generated/graphql.js';
import { logger } from '../logger.js';
import { Expense, ExpenseWithCategory } from '../models/expense';
import { calculateFortnight } from '../utils/date-utils.js';
import { adaptCardDTO } from './card-adapter.js';
import { adaptCategoryDTO } from './category-adapter.js';
import { adaptPeriod, adaptPeriodDTo } from './period-adapter.js';

export function adaptSingleIncome(x: IncomeDTO): GraphqlIncome {
  return {
    id: x.id,
    userId: x.userId,
    total: formatCurrency(x.total),
    comment: x.comment,
    period: adaptPeriod(x.period),
    paymentDate: {
      date: formatInTimeZone(x.paymentDate, 'UTC', 'dd MMMM'),
      fortnight: calculateFortnight(x.paymentDate),
    },
    createdAt: x.createdAt,
    updatedAt: x.updatedAt,
  };
}

export function adaptIncome(
  income: IncomeDTO,
  period?: PeriodDTO
): GraphqlIncome {
  const adaptedPeriod = period
    ? adaptPeriod(period)
    : income.period
      ? adaptPeriod(income.period)
      : null;
  return {
    id: income?.id,
    userId: income?.userId,
    total: formatCurrency(income?.total),
    comment: income?.comment,
    period: adaptedPeriod,
    paymentDate: {
      date: formatInTimeZone(income?.paymentDate, 'UTC', 'dd MMMM'),
      fortnight: calculateFortnight(income?.paymentDate),
    },
    createdAt: income?.createdAt,
    updatedAt: income?.updatedAt,
  };
}

// Not the best way to do this, but to avoid refactoring the service and repository layers
export const adaptIncomeAndPeriodDTO = (input): GraphqlIncome => {
  const income = adaptIncomeDTO(input.income);
  const period = adaptPeriodDTo(input.period);
  return adaptIncome(income, period);
};

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

export function adaptExpensesDTOInput(x: ExpenseDTO): GraphqlExpense {
  try {
    return {
      id: x?.id.toString(),
      concept: x?.concept,
      payBefore: x?.payBefore,
      total: formatCurrency(x.total),
      userId: x?.userId,
      periodId: x?.periodId,
      comment: x?.comments,
      createdAt: x?.createdAt,
      updatedAt: x?.updatedAt,
      card: x?.card
        ? adaptCardDTO(x.card)
        : null,
      category: adaptCategoryDTO(x.category),
      subCategory: adaptCategoryDTO(x.category.subCategories[0]),
    };
  } catch (error) {
    logger.error(error.message);
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

export const adaptIncomeDTO = (income): IncomeDTO => {
  return {
    id: income.id,
    userId: income.userId,
    total: income.total,
    paymentDate: income.paymentDate,
    comment: income.comment,
    period: income.period ? adaptPeriodDTo(income.period) : null,
    createdAt: income.createdAt,
    updatedAt: income.updatedAt,
  };
};

export const adaptIncomeCategoryAllocationDTO = (
  income
): IncomeWithCategoryAllocationDTO => {
  return {
    percentage: income.percentage,
    amountAllocated: income.amountAllocated,
    category: adaptCategoryDTO(income.category),
    income: adaptIncomeDTO(income.income),
  };
};

export const adaptRawExpenseWIthIncome = (expense): ExpenseDTO[] => {
  return expense.map((exp) => ({
    id: exp.id,
    userId: exp.userId,
    card: exp.card ? adaptCardDTO(exp.card) : null,
    category: adaptCategoryDTO(
      exp.sub_category.category,
      exp.sub_category
    ),
    periodId: exp.periodId,
    subCategoryId: exp.subCategoryId,
    concept: exp.concept,
    total: exp.total,
    comments: exp.comments,
    payBefore: exp.payBefore,
    createdAt: exp.createdAt,
    updatedAt: exp.updatedAt,
  })); 
}
