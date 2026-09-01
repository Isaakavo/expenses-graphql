import { formatInTimeZone } from 'date-fns-tz';
import {
  StagedTransaction as GraphqlStagedTransaction,
  TransactionReviewStatus,
  TransactionSyncResult as GraphqlTransactionSyncResult,
} from '../generated/graphql.js';
import { adaptCard, adaptExpenses, formatCurrency } from './income-adapter.js';
import { adaptPeriod } from './period-adapter.js';
import { StagedTransactionWithAssociations } from '../repository/staged-transaction-repository.js';

const REVIEW_STATUS_TO_GRAPHQL: Record<string, TransactionReviewStatus> = {
  PENDING: TransactionReviewStatus.PENDING,
  PROMOTED: TransactionReviewStatus.PROMOTED,
  DISMISSED: TransactionReviewStatus.DISMISSED,
};

export const adaptStagedTransactionDTO = (
  row: StagedTransactionWithAssociations
): GraphqlStagedTransaction => ({
  id: row.id,
  card: adaptCard(row.card),
  description: row.description,
  total: formatCurrency(row.total),
  transactionDate: formatInTimeZone(row.transactionDate, 'UTC', 'dd MMM yyyy'),
  providerPending: row.providerPending,
  reviewStatus: REVIEW_STATUS_TO_GRAPHQL[row.reviewStatus],
  suggestedSubCategory: row.suggested_sub_category
    ? {
      id: row.suggested_sub_category.id,
      userId: row.suggested_sub_category.userId,
      name: row.suggested_sub_category.name,
    }
    : null,
  suggestedPeriod: row.suggested_period ? adaptPeriod(row.suggested_period) : null,
  promotedExpense: row.promoted_expense ? adaptExpenses(row.promoted_expense) : null,
  createdAt: row.createdAt ? formatInTimeZone(row.createdAt, 'UTC', 'dd MMM yyyy') : null,
  updatedAt: row.updatedAt ? formatInTimeZone(row.updatedAt, 'UTC', 'dd MMM yyyy') : null,
});

export const adaptTransactionSyncResult = (result: {
  cardId: string;
  newTransactions: number;
  updatedTransactions: number;
  syncedAt: Date;
  error?: string;
}): GraphqlTransactionSyncResult => ({
  cardId: result.cardId,
  newTransactions: result.newTransactions,
  updatedTransactions: result.updatedTransactions,
  syncedAt: result.syncedAt.toISOString(),
  error: result.error ?? null,
});
