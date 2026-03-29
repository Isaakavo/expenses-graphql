import { formatInTimeZone } from 'date-fns-tz';
import { ExpensesByCategory, GroupedExpenses } from 'generated/graphql.js';
import {
  ExpenseDTO,
  ExpenseWithCategoryAllocationDTO,
  GroupedExpensesDTO,
} from '../dto';
import { adaptCardDTO } from './card-adapter.js';
import { adaptCategoryDTO } from './category-adapter.js';
import { adaptExpensesDTOInput, formatCurrency } from './income-adapter.js';

export const adaptSingleRawExpenseDTO = (exp): ExpenseDTO => {
  return {
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
  };
};

export const adaptRawListExpense= (expense): ExpenseDTO[] => {
  return expense.map((exp) => adaptSingleRawExpenseDTO(exp));
}

export const adaptGroupedExpenses = (
  groupedExpenses: GroupedExpensesDTO[]
): GroupedExpenses[] => {
  return groupedExpenses.map((groupedExpense) => {
    return {
      date: formatInTimeZone(groupedExpense.date, 'UTC', 'EEE dd MMM'),
      total: formatCurrency(groupedExpense.total),
      expenses: groupedExpense.expenses.map((expense) =>
        adaptExpensesDTOInput(expense)
      ),
    };
  });
};

export const adaptExpenseWithCategoryAllocationDTO = (
  expense
): ExpenseWithCategoryAllocationDTO => {
  return {
    totalSpent: expense.totalSpent,
    category: {
      id: expense.categoryId,
      name: expense.categoryName,
    },
  };
};

// This is an special case for the expenses DTO, this is used when the query returns custom objects
export const adaptExpenseDTO = (expense): ExpenseDTO => {
  return {
    id: expense.expense.id,
    userId: expense.expense.userId,
    card: expense.card ? adaptCardDTO(expense.card) : null,
    category: adaptCategoryDTO(expense.category, expense.subCategory),
    periodId: expense.expense.periodId,
    subCategoryId: expense.expense.subCategoryId,
    concept: expense.expense.concept,
    total: expense.expense.total,
    comments: expense.expense.comments,
    payBefore: expense.expense.payBefore,
    createdAt: expense.expense.createdAt,
    updatedAt: expense.expense.updatedAt,
  };
};

export const adaptExpensesByCategoryDTO = (
  expenses: ExpenseDTO[]
): ExpensesByCategory[] => {
  const grouped = expenses.reduce((acc, expense) => {
    const cat = expense.category;
    const subCat = cat.subCategories?.[0];

    if (!acc[cat.id]) {
      acc[cat.id] = {
        category: { id: cat.id, userId: cat.userId, name: cat.name },
        subCategories: {},
        total: 0,
      };
    }

    acc[cat.id].total += expense.total;

    if (subCat) {
      if (!acc[cat.id].subCategories[subCat.id]) {
        acc[cat.id].subCategories[subCat.id] = {
          subCategory: { id: subCat.id, userId: subCat.userId, name: subCat.name },
          expenses: [],
          total: 0,
        };
      }

      acc[cat.id].subCategories[subCat.id].expenses.push(expense);
      acc[cat.id].subCategories[subCat.id].total += expense.total;
    }

    return acc;
  }, {} as Record<string, any>);

  return Object.values(grouped).map((catGroup: any) => ({
    category: catGroup.category,
    subCategories: Object.values(catGroup.subCategories).map((subGroup: any) => ({
      subCategory: subGroup.subCategory,
      expenses: subGroup.expenses.map((exp) => adaptExpensesDTOInput(exp)),
      total: formatCurrency(subGroup.total),
    })),
    total: formatCurrency(catGroup.total),
  }));
};

export const adaptGroupedExpensesDTO = (groupedExpense): GroupedExpensesDTO => {
  return {
    date: groupedExpense.date,
    expenses: groupedExpense.expenses.map((expense) => {
      const expenseObj = {
        ...expense,
        ...expense.card,
        ...expense.category,
        ...expense.subCategory,
      };

      return adaptExpenseDTO(expenseObj);
    }),
    total: groupedExpense.total,
  };
};
