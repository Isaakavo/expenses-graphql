import { Card, Category, Expense, SubCategory } from '../models/index.js';
import { CurrencyCode, GoalRole } from '../generated/graphql.js';
import { CardDTO } from './card-dto';
import { CategoryDTO } from './category-dto';

export type ForeignAmountDTO = {
  amount: number;
  currency: CurrencyCode;
  rate: number;
  rateDate: string;
  rateSource: string;
  fixedRate: boolean;
};

export type ForeignColumns = {
  originalTotal: string | null;
  originalCurrency: CurrencyCode | null;
  exchangeRate: string | null;
  rateDate: string | null;
  rateSource: string | null;
  fixedRate: boolean;
};

export type ExpenseDTO = {
  id: string;
  userId?: string;
  card: CardDTO | null;
  category: CategoryDTO;
  periodId?: string;
  subCategoryId?: string;
  goalId?: string | null;
  goalRole?: GoalRole | null;
  concept: string;
  total: number;
  currency: CurrencyCode;
  foreignAmount: ForeignAmountDTO | null;
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
