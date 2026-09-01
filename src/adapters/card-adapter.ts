import { CardDTO } from '../dto';
import {
  ProviderConnectionStatus,
  TransactionProviderName,
} from '../generated/graphql.js';
import { ProviderName } from '../providers/provider.types.js';

const PROVIDER_NAME_TO_GRAPHQL: Record<string, TransactionProviderName> = {
  plaid: TransactionProviderName.PLAID,
};

const GRAPHQL_PROVIDER_NAME_TO_INTERNAL: Record<string, ProviderName> = {
  [TransactionProviderName.PLAID]: 'plaid',
};

const PROVIDER_STATUS_TO_GRAPHQL: Record<string, ProviderConnectionStatus> = {
  ACTIVE: ProviderConnectionStatus.ACTIVE,
  PENDING_DISCONNECT: ProviderConnectionStatus.PENDING_DISCONNECT,
  DISCONNECTED: ProviderConnectionStatus.DISCONNECTED,
  ERROR: ProviderConnectionStatus.ERROR,
};

export const adaptProviderNameToGraphql = (
  provider?: string | null
): TransactionProviderName | null =>
  provider ? (PROVIDER_NAME_TO_GRAPHQL[provider] ?? null) : null;

export const adaptProviderNameFromGraphql = (provider: string): ProviderName => {
  const mapped = GRAPHQL_PROVIDER_NAME_TO_INTERNAL[provider];
  if (!mapped) {
    throw new Error(`Unknown transaction provider: ${provider}`);
  }
  return mapped;
};

export const adaptProviderStatusToGraphql = (
  status?: string | null
): ProviderConnectionStatus | null =>
  status ? (PROVIDER_STATUS_TO_GRAPHQL[status] ?? null) : null;

export const adaptProviderDate = (date?: Date | string | null): string | null =>
  date ? new Date(date).toISOString() : null;

export const adaptCardDTO = (card): CardDTO => {
  return {
    id: card.id,
    userId: card.userId,
    bank: card.bank,
    alias: card.alias,
    isDebit: card.isDebit,
    isDigital: card.isDigital,
    provider: adaptProviderNameToGraphql(card.provider),
    providerAccountId: card.providerAccountId ?? null,
    providerConnectionId: card.providerConnectionId ?? null,
    providerStatus: adaptProviderStatusToGraphql(card.providerStatus),
    providerLinkedAt: adaptProviderDate(card.providerLinkedAt),
    providerLastSyncedAt: adaptProviderDate(card.providerLastSyncedAt),
  };
};
