export type ProviderName = 'plaid';

export type ProviderTransaction = {
  providerTransactionId: string;
  providerAccountId: string;
  description: string;
  amount: number; // positive = money out, same sign convention as Expense.total
  date: Date;
  pending: boolean;
  pendingTransactionId?: string;
  raw: unknown;
};

export type ProviderAccount = {
  providerAccountId: string;
  providerConnectionId: string;
  institutionName: string;
  last4?: string;
};

export type ProviderTransactionSyncResult = {
  transactions: ProviderTransaction[];
  removedProviderTransactionIds: string[];
  nextCursor: string;
  hasMore: boolean;
};

export type ProviderWebhookEvent =
  | { type: 'TRANSACTIONS_UPDATED'; providerConnectionId: string }
  | { type: 'CONNECTION_DISCONNECTED'; providerConnectionId: string }
  | { type: 'CONNECTION_EXPIRING'; providerConnectionId: string }
  | { type: 'CONNECTION_RESTORED'; providerConnectionId: string }
  | { type: 'UNKNOWN'; raw: unknown };

export interface TransactionProvider {
  readonly name: ProviderName;
  listAccounts(accessToken: string): Promise<ProviderAccount[]>;
  createLinkSession?(input: { userId: string }): Promise<{ linkToken: string }>;
  exchangeToken?(rawToken: string): Promise<{
    accessToken: string;
    providerConnectionId: string;
  }>;
  listTransactions(input: {
    accessToken: string;
    cursor: string | null;
  }): Promise<ProviderTransactionSyncResult>;
  verifyWebhookSignature(input: {
    rawBody: string;
    headers: Record<string, string>;
  }): Promise<boolean>;
  parseWebhookPayload(input: {
    rawBody: string;
    headers: Record<string, string>;
  }): Promise<ProviderWebhookEvent>;
}
