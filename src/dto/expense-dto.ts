export type ExpenseDTO = {
  id: string;
  userId: string;
  cardId: string;
  periodId: string;
  subCategoryId: string;
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
