import { CategoryDTO } from './category-dto.js';
import { PeriodDTO } from './period-dto.js';

export type IncomeDTO = {
  id: string;
  userId: string;
  total: number;
  paymentDate: Date;
  comment?: string | null;
  period?: PeriodDTO | null;
  createdAt: Date;
  updatedAt: Date;
};

export type IncomeWithCategoryAllocationDTO = {
  percentage: number;
  amountAllocated: number;
  category: CategoryDTO;
  income: IncomeDTO;
};
