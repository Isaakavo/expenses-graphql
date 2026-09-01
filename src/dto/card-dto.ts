import { ProviderConnectionStatus, TransactionProviderName } from '../generated/graphql.js';

export type CardDTO = {
  id: string;
  bank: string;
  userId: string;
  alias: string;
  isDebit: boolean;
  isDigital: boolean;
  provider?: TransactionProviderName | null;
  providerAccountId?: string | null;
  providerConnectionId?: string | null;
  providerStatus?: ProviderConnectionStatus | null;
  providerLinkedAt?: string | null;
  providerLastSyncedAt?: string | null;
}
