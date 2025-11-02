import { Card, Category, Expense, SubCategory } from '../models/index.js';
import { CardDTO } from './card-dto';
import { CategoryDTO } from './category-dto';

export type ExpenseDTO = {
  id: string;
  userId?: string;
  card: CardDTO | null;
  category: CategoryDTO;
  periodId?: string;
  subCategoryId?: string;
  concept: string;
  total: number;
  comments?: string | null;
  payBefore: Date;
  createdAt: Date;
  updatedAt: Date;
};

export type ExpenseWithCategoryAllocationDTO = {
  totalSpent: number;
  category: {
    id: string;
    name: string;
  };
};

export type GroupedExpensesDTO = {
  date: string;
  expenses: ExpenseDTO[];
  total: number;
};

// Special type to handle Sequelize return
export type ExpenseWithCategoryRaw = Expense & {
  card: Card;
  sub_category: SubCategory & {
    category: Category;
  };
};
