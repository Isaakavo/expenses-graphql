import { formatInTimeZone } from 'date-fns-tz';
import { GroupedExpenses } from 'generated/graphql.js';
import {
  ExpenseDTO,
  ExpenseWithCategoryAllocationDTO,
  GroupedExpensesDTO,
} from '../dto/expense-dto.js';
import { adaptCardDTO } from './card-adapter.js';
import { adaptCategoryDTO } from './category-adapter.js';
import { adaptExpensesDTOInput, formatCurrency } from './income-adapter.js';

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

export const adaptGroupedExpenses = (
  groupedExpenses: GroupedExpensesDTO[]
): GroupedExpenses[] => {
  return groupedExpenses.map((groupedExpense) => {
    return {
      date: formatInTimeZone(groupedExpense.date, 'UTC', 'dd MMMM'),
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

      // console.log({ expenseObj });
      return adaptExpenseDTO(expenseObj);
    }),
    total: groupedExpense.total,
  };
};
