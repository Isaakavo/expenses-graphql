import type {
  AccountBase,
  Item,
  RemovedTransaction,
  Transaction,
  TransactionsSyncResponse,
} from 'plaid';
import {
  ProviderAccount,
  ProviderTransaction,
  ProviderTransactionSyncResult,
  ProviderWebhookEvent,
} from '../provider.types.js';

const EXPIRING_ITEM_WEBHOOK_CODES = new Set(['PENDING_DISCONNECT', 'PENDING_EXPIRATION']);
const DISCONNECT_ITEM_WEBHOOK_CODES = new Set(['USER_PERMISSION_REVOKED', 'USER_ACCOUNT_REVOKED']);
const ITEM_LOGIN_REQUIRED_ERROR_CODE = 'ITEM_LOGIN_REQUIRED';

export const mapTransaction = (raw: Partial<Transaction>): ProviderTransaction => ({
  providerTransactionId: raw.transaction_id,
  providerAccountId: raw.account_id,
  description: raw.merchant_name || raw.name || '',
  amount: raw.amount,
  date: new Date(raw.date),
  pending: raw.pending ?? false,
  pendingTransactionId: raw.pending_transaction_id ?? undefined,
  raw,
});

export const mapAccount = (
  account: Partial<AccountBase>,
  item: Partial<Item>
): ProviderAccount => ({
  providerAccountId: account.account_id,
  providerConnectionId: item.item_id,
  institutionName: item.institution_name ?? '',
  last4: account.mask ?? undefined,
});

export type SyncResultLike = {
  added: Partial<Transaction>[];
  modified: Partial<Transaction>[];
  removed: RemovedTransaction[];
  next_cursor: TransactionsSyncResponse['next_cursor'];
  has_more: TransactionsSyncResponse['has_more'];
};

export const mapSyncResult = (
  raw: SyncResultLike
): ProviderTransactionSyncResult => ({
  transactions: [...(raw.added ?? []), ...(raw.modified ?? [])].map(mapTransaction),
  removedProviderTransactionIds: (raw.removed ?? []).map(
    (removed) => removed.transaction_id
  ),
  nextCursor: raw.next_cursor,
  hasMore: raw.has_more,
});

type PlaidWebhookBody = {
  webhook_type?: string;
  webhook_code?: string;
  item_id?: string;
  error?: { error_code?: string } | null;
};

const mapItemWebhook = (body: PlaidWebhookBody): ProviderWebhookEvent => {
  if (!body.webhook_code || !body.item_id) {
    return { type: 'UNKNOWN', raw: body };
  }

  if (EXPIRING_ITEM_WEBHOOK_CODES.has(body.webhook_code)) {
    return { type: 'CONNECTION_EXPIRING', providerConnectionId: body.item_id };
  }

  if (DISCONNECT_ITEM_WEBHOOK_CODES.has(body.webhook_code)) {
    return { type: 'CONNECTION_DISCONNECTED', providerConnectionId: body.item_id };
  }

  if (body.webhook_code === 'ERROR') {
    return body.error?.error_code === ITEM_LOGIN_REQUIRED_ERROR_CODE
      ? { type: 'CONNECTION_DISCONNECTED', providerConnectionId: body.item_id }
      : { type: 'UNKNOWN', raw: body };
  }

  if (body.webhook_code === 'LOGIN_REPAIRED') {
    return { type: 'CONNECTION_RESTORED', providerConnectionId: body.item_id };
  }

  return { type: 'UNKNOWN', raw: body };
};

export const mapWebhookPayload = (
  body: PlaidWebhookBody | null | undefined
): ProviderWebhookEvent => {
  if (
    body?.webhook_type === 'TRANSACTIONS' &&
    body?.webhook_code === 'SYNC_UPDATES_AVAILABLE' &&
    body.item_id
  ) {
    return { type: 'TRANSACTIONS_UPDATED', providerConnectionId: body.item_id };
  }

  if (body?.webhook_type === 'ITEM') {
    return mapItemWebhook(body);
  }

  return { type: 'UNKNOWN', raw: body };
};
