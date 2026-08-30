import { CardDTO } from './card-dto.js';

export type StagedTransactionDTO = {
  id: string;
  userId: string;
  card: CardDTO | null;
  provider: string;
  providerTransactionId: string;
  description: string;
  total: number;
  transactionDate: Date;
  providerPending: boolean;
  reviewStatus: string;
  suggestedSubCategoryId?: string | null;
  suggestedPeriodId?: string | null;
  suggestionSource?: string | null;
  promotedExpenseId?: string | null;
  createdAt: Date;
  updatedAt: Date;
};
