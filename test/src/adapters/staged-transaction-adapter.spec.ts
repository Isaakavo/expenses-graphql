import { describe, it, expect } from 'vitest';
import { adaptStagedTransactionDTO } from '../../../src/adapters/staged-transaction-adapter.js';

const buildCard = (overrides: Partial<Record<string, unknown>> = {}) => ({
  id: 'card-1',
  userId: 'user-1',
  alias: 'Chase Sapphire',
  bank: 'Chase',
  isDebit: false,
  isDigital: false,
  provider: 'plaid',
  providerStatus: 'ACTIVE',
  providerLinkedAt: new Date('2026-01-01T00:00:00Z'),
  providerLastSyncedAt: new Date('2026-04-01T00:00:00Z'),
  providerAccessTokenCiphertext: 'super-secret-ciphertext',
  providerAccessTokenIv: 'super-secret-iv',
  providerAccessTokenAuthTag: 'super-secret-authtag',
  ...overrides,
});

const asRow = (row: unknown) =>
  row as Parameters<typeof adaptStagedTransactionDTO>[0];

const buildRow = (overrides: Partial<Record<string, unknown>> = {}) =>
  asRow({
    id: 'staged-1',
    card: buildCard(),
    description: 'Costco',
    total: 42.5,
    transactionDate: new Date('2026-04-01T00:00:00Z'),
    providerPending: false,
    reviewStatus: 'PENDING',
    suggested_sub_category: null,
    suggested_period: null,
    promoted_expense: null,
    createdAt: new Date('2026-04-01T00:00:00Z'),
    updatedAt: new Date('2026-04-01T00:00:00Z'),
    ...overrides,
  });

const containsProviderTokenKey = (value: unknown): boolean =>
  JSON.stringify(value).includes('providerAccessToken');

describe('adaptStagedTransactionDTO', () => {
  it('never leaks the card provider access token ciphertext/iv/authTag', () => {
    const result = adaptStagedTransactionDTO(buildRow());

    expect(containsProviderTokenKey(result)).toBe(false);
  });

  it('still maps the card fields adaptCard exposes', () => {
    const result = adaptStagedTransactionDTO(buildRow());

    expect(result.card.id).toBe('card-1');
    expect(result.card.bank).toBe('Chase');
  });

  it('does not leak the promoted expense card provider access token either', () => {
    const promotedExpenseCard = buildCard({ id: 'card-2' });
    const row = buildRow({
      promoted_expense: {
        id: 'expense-1',
        concept: 'Costco',
        payBefore: new Date('2026-04-10T00:00:00Z'),
        total: 42.5,
        userId: 'user-1',
        periodId: 'period-1',
        comments: null,
        createdAt: new Date('2026-04-01T00:00:00Z'),
        updatedAt: new Date('2026-04-01T00:00:00Z'),
        card: promotedExpenseCard,
        sub_category: {
          id: 'sub-1',
          userId: 'user-1',
          name: 'Groceries',
          category: { id: 'cat-1', userId: 'user-1', name: 'Living' },
        },
      },
    });

    const result = adaptStagedTransactionDTO(row);

    expect(containsProviderTokenKey(result)).toBe(false);
  });
});
