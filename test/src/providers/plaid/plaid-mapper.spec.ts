import { describe, it, expect } from 'vitest';
import {
  mapAccount,
  mapSyncResult,
  mapTransaction,
  mapWebhookPayload,
} from '../../../../src/providers/plaid/plaid-mapper.js';

describe('plaid-mapper.mapTransaction', () => {
  const baseRaw = {
    transaction_id: 'txn-1',
    account_id: 'acct-1',
    amount: 42.5,
    date: '2026-08-01',
    pending: false,
    pending_transaction_id: null,
    merchant_name: 'Costco',
    name: 'COSTCO WHSE #123',
  };

  it('passes pending: false through unchanged', () => {
    expect(mapTransaction(baseRaw).pending).toBe(false);
  });

  it('passes pending: true through unchanged', () => {
    expect(mapTransaction({ ...baseRaw, pending: true }).pending).toBe(true);
  });

  it('does not invert the amount sign (regression test)', () => {
    expect(mapTransaction({ ...baseRaw, amount: 42.5 }).amount).toBe(42.5);
    expect(mapTransaction({ ...baseRaw, amount: -10 }).amount).toBe(-10);
  });

  it('maps pending_transaction_id when present', () => {
    const result = mapTransaction({
      ...baseRaw,
      pending_transaction_id: 'pending-txn-1',
    });
    expect(result.pendingTransactionId).toBe('pending-txn-1');
  });

  it('maps pending_transaction_id to undefined (not null) when absent', () => {
    const result = mapTransaction(baseRaw);
    expect(result.pendingTransactionId).toBeUndefined();
  });

  it('falls back to name when merchant_name is missing', () => {
    const result = mapTransaction({
      ...baseRaw,
      merchant_name: null,
    });
    expect(result.description).toBe('COSTCO WHSE #123');
  });

  it('falls back to empty string when both merchant_name and name are missing', () => {
    const result = mapTransaction({
      ...baseRaw,
      merchant_name: null,
      name: undefined,
    });
    expect(result.description).toBe('');
  });

  it('never throws on malformed input', () => {
    expect(() => mapTransaction({})).not.toThrow();
  });
});

describe('plaid-mapper.mapAccount', () => {
  it('maps account_id, item_id, institution name, and mask', () => {
    const account = { account_id: 'acct-1', mask: '1234' };
    const item = { item_id: 'item-1', institution_name: 'Chase' };

    const result = mapAccount(account, item);

    expect(result).toEqual({
      providerAccountId: 'acct-1',
      providerConnectionId: 'item-1',
      institutionName: 'Chase',
      last4: '1234',
    });
  });

  it('never throws on a missing mask', () => {
    const account = { account_id: 'acct-1', mask: null };
    const item = { item_id: 'item-1', institution_name: null };

    expect(() => mapAccount(account, item)).not.toThrow();
  });
});

describe('plaid-mapper.mapSyncResult', () => {
  const txn = (id: string) => ({
    transaction_id: id,
    account_id: 'acct-1',
    amount: 1,
    date: '2026-08-01',
    pending: false,
    pending_transaction_id: null,
    merchant_name: 'Merchant',
    name: 'Merchant',
  });

  it('concatenates added and modified into transactions', () => {
    const result = mapSyncResult({
      added: [txn('a1')],
      modified: [txn('m1')],
      removed: [],
      next_cursor: 'cursor-1',
      has_more: false,
    });

    expect(result.transactions.map((t) => t.providerTransactionId)).toEqual([
      'a1',
      'm1',
    ]);
  });

  it('a modified-only response still produces non-empty transactions', () => {
    const result = mapSyncResult({
      added: [],
      modified: [txn('m1')],
      removed: [],
      next_cursor: 'cursor-1',
      has_more: false,
    });

    expect(result.transactions).toHaveLength(1);
  });

  it('maps removed transactions by transaction_id', () => {
    const result = mapSyncResult({
      added: [],
      modified: [],
      removed: [{ transaction_id: 'r1', account_id: 'acct-1' }],
      next_cursor: 'cursor-1',
      has_more: false,
    });

    expect(result.removedProviderTransactionIds).toEqual(['r1']);
  });

  it('passes has_more and next_cursor through verbatim', () => {
    const result = mapSyncResult({
      added: [],
      modified: [],
      removed: [],
      next_cursor: 'cursor-xyz',
      has_more: true,
    });

    expect(result.hasMore).toBe(true);
    expect(result.nextCursor).toBe('cursor-xyz');
  });

  it('empty added/modified/removed produces empty arrays, not an error', () => {
    const result = mapSyncResult({
      added: [],
      modified: [],
      removed: [],
      next_cursor: '',
      has_more: false,
    });

    expect(result).toMatchObject({
      transactions: [],
      removedProviderTransactionIds: [],
    });
  });
});

describe('plaid-mapper.mapWebhookPayload', () => {
  it('maps TRANSACTIONS/SYNC_UPDATES_AVAILABLE to TRANSACTIONS_UPDATED', () => {
    const result = mapWebhookPayload({
      webhook_type: 'TRANSACTIONS',
      webhook_code: 'SYNC_UPDATES_AVAILABLE',
      item_id: 'item-1',
    });

    expect(result).toEqual({
      type: 'TRANSACTIONS_UPDATED',
      providerConnectionId: 'item-1',
    });
  });

  it('maps ITEM/PENDING_DISCONNECT to CONNECTION_EXPIRING', () => {
    const result = mapWebhookPayload({
      webhook_type: 'ITEM',
      webhook_code: 'PENDING_DISCONNECT',
      item_id: 'item-1',
    });

    expect(result).toEqual({
      type: 'CONNECTION_EXPIRING',
      providerConnectionId: 'item-1',
    });
  });

  it('maps ITEM/PENDING_EXPIRATION to CONNECTION_EXPIRING', () => {
    const result = mapWebhookPayload({
      webhook_type: 'ITEM',
      webhook_code: 'PENDING_EXPIRATION',
      item_id: 'item-1',
    });

    expect(result).toEqual({
      type: 'CONNECTION_EXPIRING',
      providerConnectionId: 'item-1',
    });
  });

  it('maps ITEM/USER_PERMISSION_REVOKED to CONNECTION_DISCONNECTED', () => {
    const result = mapWebhookPayload({
      webhook_type: 'ITEM',
      webhook_code: 'USER_PERMISSION_REVOKED',
      item_id: 'item-1',
    });

    expect(result).toEqual({
      type: 'CONNECTION_DISCONNECTED',
      providerConnectionId: 'item-1',
    });
  });

  it('maps ITEM/USER_ACCOUNT_REVOKED to CONNECTION_DISCONNECTED', () => {
    const result = mapWebhookPayload({
      webhook_type: 'ITEM',
      webhook_code: 'USER_ACCOUNT_REVOKED',
      item_id: 'item-1',
    });

    expect(result).toEqual({
      type: 'CONNECTION_DISCONNECTED',
      providerConnectionId: 'item-1',
    });
  });

  it('maps ITEM/ERROR with error_code ITEM_LOGIN_REQUIRED to CONNECTION_DISCONNECTED', () => {
    const result = mapWebhookPayload({
      webhook_type: 'ITEM',
      webhook_code: 'ERROR',
      item_id: 'item-1',
      error: { error_code: 'ITEM_LOGIN_REQUIRED' },
    });

    expect(result).toEqual({
      type: 'CONNECTION_DISCONNECTED',
      providerConnectionId: 'item-1',
    });
  });

  it('maps ITEM/ERROR with a different error_code to UNKNOWN (treated as transient, not a disconnect)', () => {
    const claims = {
      webhook_type: 'ITEM',
      webhook_code: 'ERROR',
      item_id: 'item-1',
      error: { error_code: 'INSTITUTION_NOT_RESPONDING' },
    };
    const result = mapWebhookPayload(claims);

    expect(result).toEqual({ type: 'UNKNOWN', raw: claims });
  });

  it('maps ITEM/ERROR with no error object to UNKNOWN (treated as transient, not a disconnect)', () => {
    const claims = { webhook_type: 'ITEM', webhook_code: 'ERROR', item_id: 'item-1' };
    const result = mapWebhookPayload(claims);

    expect(result).toEqual({ type: 'UNKNOWN', raw: claims });
  });

  it('maps ITEM/LOGIN_REPAIRED to CONNECTION_RESTORED', () => {
    const result = mapWebhookPayload({
      webhook_type: 'ITEM',
      webhook_code: 'LOGIN_REPAIRED',
      item_id: 'item-1',
    });

    expect(result).toEqual({
      type: 'CONNECTION_RESTORED',
      providerConnectionId: 'item-1',
    });
  });

  it('maps ITEM webhook with a webhook_code but no item_id to UNKNOWN', () => {
    const claims = { webhook_type: 'ITEM', webhook_code: 'LOGIN_REPAIRED' };
    const result = mapWebhookPayload(claims);

    expect(result).toEqual({ type: 'UNKNOWN', raw: claims });
  });

  it('maps an unrecognized combination to UNKNOWN without throwing', () => {
    const claims = { webhook_type: 'SOMETHING', webhook_code: 'ELSE' };
    const result = mapWebhookPayload(claims);

    expect(result).toEqual({ type: 'UNKNOWN', raw: claims });
  });

  it('never throws on malformed input', () => {
    expect(() => mapWebhookPayload(null)).not.toThrow();
    expect(mapWebhookPayload(null).type).toBe('UNKNOWN');
  });
});
