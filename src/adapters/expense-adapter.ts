import { ExpenseDTO, ExpenseWithCategoryAllocationDTO } from '../dto/expense-dto.js';

export const adaptExpenseDTO = (expense): ExpenseDTO => {
  return {
    id: expense.id,
    userId: expense.userId,
    cardId: expense.cardId,
    periodId: expense.periodId,
    subCategoryId: expense.subCategoryId,
    concept: expense.concept,
    total: expense.total,
    comments: expense.comments,
    payBefore: expense.payBefore,
    createdAt: expense.createdAt,
    updatedAt: expense.updatedAt,
  }
};

export const adaptExpenseWithCategoryAllocationDTO = (expense): ExpenseWithCategoryAllocationDTO => {
  return {
    totalSpent: expense.totalSpent,
    category: {
      id: expense.categoryId,
      name: expense.categoryName,
    },
  };
}
