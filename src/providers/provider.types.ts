export type ProviderName = 'teller';

export type ProviderTransaction = {
  providerTransactionId: string;
  providerAccountId: string;
  description: string;
  amount: number; // positive = money out, same sign convention as Expense.total
  date: Date;
  pending: boolean;
  raw: unknown;
};

export type ProviderAccount = {
  providerAccountId: string;
  providerConnectionId: string;
  institutionName: string;
  last4?: string;
};

export type ProviderWebhookEvent =
  | { type: 'TRANSACTIONS_UPDATED'; providerAccountIds: string[] }
  | { type: 'CONNECTION_DISCONNECTED'; providerConnectionId: string }
  | { type: 'UNKNOWN'; raw: unknown };

export interface TransactionProvider {
  readonly name: ProviderName;
  listAccounts(accessToken: string): Promise<ProviderAccount[]>;
  listTransactions(input: {
    accessToken: string;
    providerAccountId: string;
    since?: Date;
  }): Promise<ProviderTransaction[]>;
  verifyWebhookSignature(input: {
    rawBody: string;
    headers: Record<string, string>;
  }): boolean;
  parseWebhookPayload(input: {
    rawBody: string;
    headers: Record<string, string>;
  }): ProviderWebhookEvent;
}
