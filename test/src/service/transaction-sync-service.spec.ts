import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Sequelize } from 'sequelize';
import { randomBytes } from 'crypto';

process.env.PROVIDER_TOKEN_ENCRYPTION_KEY = randomBytes(32).toString('base64');

const getProvider = vi.fn();

vi.mock('../../../src/providers/provider-registry.js', () => ({
  getProvider: (...args: unknown[]) => getProvider(...args),
}));

const { TransactionSyncService } = await import(
  '../../../src/service/transaction-sync-service.js'
);
const { encryptToken } = await import('../../../src/security/token-cipher.js');

const userId = 'user-1';
let service: InstanceType<typeof TransactionSyncService>;

type MockTransaction = { commit: ReturnType<typeof vi.fn>; rollback: ReturnType<typeof vi.fn> };

let transactionLog: MockTransaction[];
const createMockTransaction = (): MockTransaction => ({ commit: vi.fn(), rollback: vi.fn() });

const mockSequelize = {
  transaction: vi.fn(() => {
    const t = createMockTransaction();
    transactionLog.push(t);
    return Promise.resolve(t);
  }),
} as unknown as Sequelize;

const encryptedTokenA = encryptToken('access-token-A');
const encryptedTokenC = encryptToken('access-token-C');

const buildCard = (overrides: Partial<Record<string, unknown>> = {}) => ({
  id: 'card-A',
  userId,
  provider: 'plaid',
  providerAccountId: 'acct-A',
  providerConnectionId: 'item-1',
  providerAccessTokenCiphertext: encryptedTokenA.ciphertext,
  providerAccessTokenIv: encryptedTokenA.iv,
  providerAccessTokenAuthTag: encryptedTokenA.authTag,
  providerStatus: 'ACTIVE',
  ...overrides,
});

const buildProviderTransaction = (overrides: Partial<Record<string, unknown>> = {}) => ({
  providerTransactionId: 'txn-1',
  providerAccountId: 'acct-A',
  description: 'Costco',
  amount: 42.5,
  date: new Date('2026-04-01T00:00:00Z'),
  pending: false,
  raw: {},
  ...overrides,
});

const basePlaidProvider = {
  name: 'plaid' as const,
  listAccounts: vi.fn(),
  createLinkSession: vi.fn(),
  exchangeToken: vi.fn(),
  listTransactions: vi.fn(),
  verifyWebhookSignature: vi.fn(),
  parseWebhookPayload: vi.fn(),
};

type ServiceInternals = {
  cardRepository: unknown;
  providerConnectionRepository: unknown;
  stagedTransactionRepository: unknown;
  periodRepository: unknown;
  categorySuggestionService: unknown;
};

const withInternals = (target: InstanceType<typeof TransactionSyncService>) =>
  target as unknown as ServiceInternals;

const setupDefaultMocks = (cards = [buildCard()]) => {
  const mockFindLinkedCards = vi.fn().mockResolvedValue(cards);
  const mockUpdateProviderSyncMetadata = vi.fn().mockImplementation((cardId, _userId, fields) => ({
    ...cards.find((card) => card.id === cardId),
    ...fields,
  }));

  const mockFindForUpdate = vi.fn().mockImplementation((input) =>
    Promise.resolve({ id: `connection-${input.providerConnectionId}`, syncCursor: null })
  );
  const mockFindOrCreate = vi.fn().mockImplementation((input) =>
    Promise.resolve([{ id: `connection-${input.providerConnectionId}`, syncCursor: null }, true])
  );
  const mockUpdateCursor = vi.fn();

  const mockUpsert = vi.fn().mockResolvedValue({ row: {}, created: true, updated: false });
  const mockFindByCardAndProviderTransactionId = vi.fn().mockResolvedValue(null);
  const mockUpdateFields = vi.fn();
  const mockDeleteByProviderTransactionId = vi.fn().mockResolvedValue(0);

  const mockGetPeriodBy = vi.fn().mockResolvedValue({ id: 'period-1' });
  const mockSuggestSubCategory = vi.fn().mockResolvedValue({ subCategoryId: null, source: 'NONE' });
  const mockGetRecentHistory = vi.fn().mockResolvedValue([]);

  withInternals(service).cardRepository = {
    findLinkedCards: mockFindLinkedCards,
    updateProviderSyncMetadata: mockUpdateProviderSyncMetadata,
  };
  withInternals(service).providerConnectionRepository = {
    findForUpdate: mockFindForUpdate,
    findOrCreate: mockFindOrCreate,
    updateCursor: mockUpdateCursor,
  };
  withInternals(service).stagedTransactionRepository = {
    upsert: mockUpsert,
    findByCardAndProviderTransactionId: mockFindByCardAndProviderTransactionId,
    updateFields: mockUpdateFields,
    deleteByProviderTransactionId: mockDeleteByProviderTransactionId,
  };
  withInternals(service).periodRepository = { getPeriodBy: mockGetPeriodBy };
  withInternals(service).categorySuggestionService = {
    suggestSubCategory: mockSuggestSubCategory,
    getRecentHistory: mockGetRecentHistory,
  };

  return {
    mockFindLinkedCards,
    mockGetRecentHistory,
    mockUpdateProviderSyncMetadata,
    mockFindForUpdate,
    mockFindOrCreate,
    mockUpdateCursor,
    mockUpsert,
    mockFindByCardAndProviderTransactionId,
    mockUpdateFields,
    mockDeleteByProviderTransactionId,
    mockGetPeriodBy,
    mockSuggestSubCategory,
  };
};

beforeEach(() => {
  vi.clearAllMocks();
  transactionLog = [];
  service = new TransactionSyncService(userId, mockSequelize);
  getProvider.mockReturnValue(basePlaidProvider);
  basePlaidProvider.listTransactions.mockReset();
});

describe('syncCard', () => {
  it('throws when the card is not linked to a provider', async () => {
    setupDefaultMocks([]);

    await expect(service.syncCard('card-A')).rejects.toThrow();
  });

  it('throws for a DISCONNECTED card instead of calling the provider', async () => {
    setupDefaultMocks([buildCard({ providerStatus: 'DISCONNECTED' })]);

    await expect(service.syncCard('card-A')).rejects.toThrow();
    expect(basePlaidProvider.listTransactions).not.toHaveBeenCalled();
  });

  it('stages a new transaction, commits, and persists the final cursor once', async () => {
    const mocks = setupDefaultMocks();
    basePlaidProvider.listTransactions.mockResolvedValue({
      transactions: [buildProviderTransaction()],
      removedProviderTransactionIds: [],
      nextCursor: 'cursor-1',
      hasMore: false,
    });

    const result = await service.syncCard('card-A');

    expect(result).toEqual({
      cardId: 'card-A',
      newTransactions: 1,
      updatedTransactions: 0,
      syncedAt: expect.any(Date),
    });
    expect(mocks.mockUpsert).toHaveBeenCalledTimes(1);
    expect(mocks.mockUpdateCursor).toHaveBeenCalledTimes(1);
    expect(mocks.mockUpdateCursor).toHaveBeenCalledWith(
      { id: 'connection-item-1', cursor: 'cursor-1' },
      { transaction: transactionLog[0] }
    );
    expect(mocks.mockUpdateProviderSyncMetadata).toHaveBeenCalledWith(
      'card-A',
      userId,
      { providerLastSyncedAt: expect.any(Date) },
      { transaction: transactionLog[0] }
    );
    expect(transactionLog[0].commit).toHaveBeenCalled();
    expect(transactionLog[0].rollback).not.toHaveBeenCalled();
  });

  it('fetches the suggestion history once per connection sync, not once per transaction', async () => {
    const mocks = setupDefaultMocks();
    basePlaidProvider.listTransactions.mockResolvedValue({
      transactions: [
        buildProviderTransaction({ providerTransactionId: 'txn-1' }),
        buildProviderTransaction({ providerTransactionId: 'txn-2' }),
        buildProviderTransaction({ providerTransactionId: 'txn-3' }),
      ],
      removedProviderTransactionIds: [],
      nextCursor: 'cursor-1',
      hasMore: false,
    });

    await service.syncCard('card-A');

    expect(mocks.mockGetRecentHistory).toHaveBeenCalledTimes(1);
  });

  it('does not fetch suggestion history when there are no transactions to ingest', async () => {
    const mocks = setupDefaultMocks();
    basePlaidProvider.listTransactions.mockResolvedValue({
      transactions: [],
      removedProviderTransactionIds: [],
      nextCursor: 'cursor-1',
      hasMore: false,
    });

    await service.syncCard('card-A');

    expect(mocks.mockGetRecentHistory).not.toHaveBeenCalled();
  });

  it('a card in PENDING_DISCONNECT still syncs and remains PENDING_DISCONNECT afterwards', async () => {
    const mocks = setupDefaultMocks([buildCard({ providerStatus: 'PENDING_DISCONNECT' })]);
    basePlaidProvider.listTransactions.mockResolvedValue({
      transactions: [buildProviderTransaction()],
      removedProviderTransactionIds: [],
      nextCursor: 'cursor-1',
      hasMore: false,
    });

    await service.syncCard('card-A');

    expect(mocks.mockUpdateProviderSyncMetadata).toHaveBeenCalledWith(
      'card-A',
      userId,
      { providerLastSyncedAt: expect.any(Date) },
      { transaction: transactionLog[0] }
    );
    expect(mocks.mockUpdateProviderSyncMetadata).not.toHaveBeenCalledWith(
      'card-A',
      userId,
      expect.objectContaining({ providerStatus: expect.anything() }),
      expect.anything()
    );
  });

  it('a card in ERROR that syncs successfully becomes ACTIVE', async () => {
    const mocks = setupDefaultMocks([buildCard({ providerStatus: 'ERROR' })]);
    basePlaidProvider.listTransactions.mockResolvedValue({
      transactions: [buildProviderTransaction()],
      removedProviderTransactionIds: [],
      nextCursor: 'cursor-1',
      hasMore: false,
    });

    await service.syncCard('card-A');

    expect(mocks.mockUpdateProviderSyncMetadata).toHaveBeenCalledWith(
      'card-A',
      userId,
      { providerStatus: 'ACTIVE', providerLastSyncedAt: expect.any(Date) },
      { transaction: transactionLog[0] }
    );
  });

  it('re-syncing with no new transactions reports newTransactions: 0', async () => {
    setupDefaultMocks();
    basePlaidProvider.listTransactions.mockResolvedValue({
      transactions: [],
      removedProviderTransactionIds: [],
      nextCursor: 'cursor-1',
      hasMore: false,
    });

    const result = await service.syncCard('card-A');

    expect(result.newTransactions).toBe(0);
    expect(result.updatedTransactions).toBe(0);
  });

  it('loops while hasMore and persists only the final cursor', async () => {
    const mocks = setupDefaultMocks();
    basePlaidProvider.listTransactions
      .mockResolvedValueOnce({
        transactions: [buildProviderTransaction({ providerTransactionId: 'txn-1' })],
        removedProviderTransactionIds: [],
        nextCursor: 'cursor-intermediate',
        hasMore: true,
      })
      .mockResolvedValueOnce({
        transactions: [buildProviderTransaction({ providerTransactionId: 'txn-2' })],
        removedProviderTransactionIds: [],
        nextCursor: 'cursor-final',
        hasMore: false,
      });

    const result = await service.syncCard('card-A');

    expect(basePlaidProvider.listTransactions).toHaveBeenCalledTimes(2);
    expect(basePlaidProvider.listTransactions).toHaveBeenNthCalledWith(1, {
      accessToken: 'access-token-A',
      cursor: null,
    });
    expect(basePlaidProvider.listTransactions).toHaveBeenNthCalledWith(2, {
      accessToken: 'access-token-A',
      cursor: 'cursor-intermediate',
    });
    expect(mocks.mockUpdateCursor).toHaveBeenCalledTimes(1);
    expect(mocks.mockUpdateCursor).toHaveBeenCalledWith(
      { id: 'connection-item-1', cursor: 'cursor-final' },
      expect.anything()
    );
    expect(result.newTransactions).toBe(2);
  });

  it('throws once the hasMore loop exceeds the page cap, rather than looping forever', async () => {
    setupDefaultMocks();
    basePlaidProvider.listTransactions.mockResolvedValue({
      transactions: [],
      removedProviderTransactionIds: [],
      nextCursor: 'cursor-forever',
      hasMore: true,
    });

    await expect(service.syncCard('card-A')).rejects.toThrow();
    expect(basePlaidProvider.listTransactions.mock.calls.length).toBeLessThanOrEqual(101);
  });

  it('drops a transaction whose providerAccountId matches no tracked card, without error', async () => {
    const mocks = setupDefaultMocks();
    basePlaidProvider.listTransactions.mockResolvedValue({
      transactions: [buildProviderTransaction({ providerAccountId: 'acct-unknown' })],
      removedProviderTransactionIds: [],
      nextCursor: 'cursor-1',
      hasMore: false,
    });

    const result = await service.syncCard('card-A');

    expect(mocks.mockUpsert).not.toHaveBeenCalled();
    expect(result.newTransactions).toBe(0);
  });

  it('two sibling cards under one connection: syncCard(cardA) stages both, cursor written once; syncCard(cardB) still calls the API but gets an empty delta', async () => {
    const cardA = buildCard({ id: 'card-A', providerAccountId: 'acct-A' });
    const cardB = buildCard({ id: 'card-B', providerAccountId: 'acct-B' });
    const mocks = setupDefaultMocks([cardA, cardB]);

    basePlaidProvider.listTransactions.mockResolvedValueOnce({
      transactions: [
        buildProviderTransaction({ providerTransactionId: 'txn-A', providerAccountId: 'acct-A' }),
        buildProviderTransaction({ providerTransactionId: 'txn-B', providerAccountId: 'acct-B' }),
      ],
      removedProviderTransactionIds: [],
      nextCursor: 'cursor-1',
      hasMore: false,
    });

    const resultA = await service.syncCard('card-A');

    expect(resultA.newTransactions).toBe(1);
    expect(mocks.mockUpsert).toHaveBeenCalledTimes(2);
    expect(mocks.mockUpdateCursor).toHaveBeenCalledTimes(1);

    mocks.mockFindForUpdate.mockResolvedValue({ id: 'connection-item-1', syncCursor: 'cursor-1' });
    basePlaidProvider.listTransactions.mockResolvedValueOnce({
      transactions: [],
      removedProviderTransactionIds: [],
      nextCursor: 'cursor-2',
      hasMore: false,
    });

    const resultB = await service.syncCard('card-B');

    expect(basePlaidProvider.listTransactions).toHaveBeenCalledTimes(2);
    expect(resultB.newTransactions).toBe(0);
  });

  it('asserts the row-locked read is used to serialize sibling-card syncs', async () => {
    const mocks = setupDefaultMocks();
    basePlaidProvider.listTransactions.mockResolvedValue({
      transactions: [],
      removedProviderTransactionIds: [],
      nextCursor: 'cursor-1',
      hasMore: false,
    });

    await service.syncCard('card-A');

    expect(mocks.mockFindForUpdate).toHaveBeenCalledWith(
      { userId, provider: 'plaid', providerConnectionId: 'item-1' },
      { transaction: transactionLog[0] }
    );
  });

  it('provider API error: rolls back the sync transaction, marks the card ERROR in a separate committed transaction, then rethrows', async () => {
    const mocks = setupDefaultMocks();
    basePlaidProvider.listTransactions.mockRejectedValue(new Error('Plaid API down'));

    await expect(service.syncCard('card-A')).rejects.toThrow('Plaid API down');

    expect(transactionLog).toHaveLength(2);
    expect(transactionLog[0].rollback).toHaveBeenCalled();
    expect(transactionLog[0].commit).not.toHaveBeenCalled();
    expect(transactionLog[1].commit).toHaveBeenCalled();
    expect(transactionLog[1].rollback).not.toHaveBeenCalled();
    expect(mocks.mockUpdateProviderSyncMetadata).toHaveBeenCalledWith(
      'card-A',
      userId,
      { providerStatus: 'ERROR' },
      { transaction: transactionLog[1] }
    );
  });

  describe('pendingTransactionId reconciliation', () => {
    it('found, PENDING: updates the existing row in place including the new provider_transaction_id', async () => {
      const mocks = setupDefaultMocks();
      mocks.mockFindByCardAndProviderTransactionId.mockResolvedValue({
        id: 'staged-1',
        reviewStatus: 'PENDING',
      });
      basePlaidProvider.listTransactions.mockResolvedValue({
        transactions: [
          buildProviderTransaction({
            providerTransactionId: 'txn-posted',
            pendingTransactionId: 'txn-pending',
          }),
        ],
        removedProviderTransactionIds: [],
        nextCursor: 'cursor-1',
        hasMore: false,
      });

      const result = await service.syncCard('card-A');

      expect(mocks.mockFindByCardAndProviderTransactionId).toHaveBeenCalledWith(
        'card-A',
        'txn-pending',
        expect.anything()
      );
      expect(mocks.mockUpdateFields).toHaveBeenCalledWith(
        'staged-1',
        expect.objectContaining({
          providerTransactionId: 'txn-posted',
          providerPending: false,
        }),
        expect.anything()
      );
      expect(mocks.mockUpsert).not.toHaveBeenCalled();
      expect(result.updatedTransactions).toBe(1);
      expect(result.newTransactions).toBe(0);
    });

    it('found, PENDING: only passes fields declared on StagedTransactionUpdateFields, not userId/cardId/provider', async () => {
      const mocks = setupDefaultMocks();
      mocks.mockFindByCardAndProviderTransactionId.mockResolvedValue({
        id: 'staged-1',
        reviewStatus: 'PENDING',
      });
      basePlaidProvider.listTransactions.mockResolvedValue({
        transactions: [
          buildProviderTransaction({
            providerTransactionId: 'txn-posted',
            pendingTransactionId: 'txn-pending',
          }),
        ],
        removedProviderTransactionIds: [],
        nextCursor: 'cursor-1',
        hasMore: false,
      });

      await service.syncCard('card-A');

      const [, fieldsArg] = mocks.mockUpdateFields.mock.calls[0];
      expect(Object.keys(fieldsArg).sort()).toEqual(
        [
          'providerTransactionId',
          'description',
          'total',
          'transactionDate',
          'providerPending',
          'suggestedSubCategoryId',
          'suggestedPeriodId',
          'suggestionSource',
          'rawPayload',
        ].sort()
      );
    });

    it('found, PROMOTED: updates only provider_transaction_id/provider_pending, inserts nothing', async () => {
      const mocks = setupDefaultMocks();
      mocks.mockFindByCardAndProviderTransactionId.mockResolvedValue({
        id: 'staged-1',
        reviewStatus: 'PROMOTED',
      });
      basePlaidProvider.listTransactions.mockResolvedValue({
        transactions: [
          buildProviderTransaction({
            providerTransactionId: 'txn-posted',
            pendingTransactionId: 'txn-pending',
          }),
        ],
        removedProviderTransactionIds: [],
        nextCursor: 'cursor-1',
        hasMore: false,
      });

      await service.syncCard('card-A');

      expect(mocks.mockUpdateFields).toHaveBeenCalledWith(
        'staged-1',
        { providerTransactionId: 'txn-posted', providerPending: false },
        expect.anything()
      );
      expect(mocks.mockUpsert).not.toHaveBeenCalled();
    });

    it('not found: falls back to a normal insert under the new id', async () => {
      const mocks = setupDefaultMocks();
      mocks.mockFindByCardAndProviderTransactionId.mockResolvedValue(null);
      basePlaidProvider.listTransactions.mockResolvedValue({
        transactions: [
          buildProviderTransaction({
            providerTransactionId: 'txn-posted',
            pendingTransactionId: 'txn-pending',
          }),
        ],
        removedProviderTransactionIds: [],
        nextCursor: 'cursor-1',
        hasMore: false,
      });

      await service.syncCard('card-A');

      expect(mocks.mockUpsert).toHaveBeenCalledWith(
        expect.objectContaining({ providerTransactionId: 'txn-posted' }),
        expect.anything()
      );
    });
  });

  describe('removedProviderTransactionIds', () => {
    it('deletes the matching PENDING staged rows scoped to the sibling cards', async () => {
      const mocks = setupDefaultMocks();
      basePlaidProvider.listTransactions.mockResolvedValue({
        transactions: [],
        removedProviderTransactionIds: ['txn-removed'],
        nextCursor: 'cursor-1',
        hasMore: false,
      });

      await service.syncCard('card-A');

      expect(mocks.mockDeleteByProviderTransactionId).toHaveBeenCalledWith(
        { cardIds: ['card-A'], providerTransactionId: 'txn-removed' },
        expect.anything()
      );
    });
  });
});

describe('syncAllLinkedCards', () => {
  it('groups by connection and syncs each connection once, skipping DISCONNECTED cards', async () => {
    const cardA = buildCard({ id: 'card-A', providerConnectionId: 'item-1' });
    const cardB = buildCard({
      id: 'card-B',
      providerConnectionId: 'item-1',
      providerAccountId: 'acct-B',
    });
    const cardC = buildCard({
      id: 'card-C',
      providerConnectionId: 'item-2',
      providerAccountId: 'acct-C',
      providerAccessTokenCiphertext: encryptedTokenC.ciphertext,
      providerAccessTokenIv: encryptedTokenC.iv,
      providerAccessTokenAuthTag: encryptedTokenC.authTag,
    });
    const cardDisconnected = buildCard({
      id: 'card-D',
      providerConnectionId: 'item-3',
      providerStatus: 'DISCONNECTED',
    });
    setupDefaultMocks([cardA, cardB, cardC, cardDisconnected]);

    basePlaidProvider.listTransactions.mockResolvedValue({
      transactions: [],
      removedProviderTransactionIds: [],
      nextCursor: 'cursor-1',
      hasMore: false,
    });

    const results = await service.syncAllLinkedCards();

    expect(basePlaidProvider.listTransactions).toHaveBeenCalledTimes(2);
    expect(results.map((r: { cardId: string }) => r.cardId).sort()).toEqual([
      'card-A',
      'card-B',
      'card-C',
    ]);
  });

  it('one connection failing does not abort the others', async () => {
    const cardA = buildCard({ id: 'card-A', providerConnectionId: 'item-1' });
    const cardC = buildCard({
      id: 'card-C',
      providerConnectionId: 'item-2',
      providerAccountId: 'acct-C',
      providerAccessTokenCiphertext: encryptedTokenC.ciphertext,
      providerAccessTokenIv: encryptedTokenC.iv,
      providerAccessTokenAuthTag: encryptedTokenC.authTag,
    });
    const mocks = setupDefaultMocks([cardA, cardC]);

    basePlaidProvider.listTransactions.mockImplementation(({ accessToken }) => {
      if (accessToken === 'access-token-A') {
        return Promise.reject(new Error('Plaid API down'));
      }
      return Promise.resolve({
        transactions: [],
        removedProviderTransactionIds: [],
        nextCursor: 'cursor-2',
        hasMore: false,
      });
    });

    const results = await service.syncAllLinkedCards();

    expect(results.map((r: { cardId: string }) => r.cardId).sort()).toEqual(['card-A', 'card-C']);

    const cardAResult = results.find((r: { cardId: string }) => r.cardId === 'card-A');
    expect(cardAResult).toMatchObject({
      cardId: 'card-A',
      newTransactions: 0,
      updatedTransactions: 0,
      error: 'Plaid API down',
    });

    const cardCResult = results.find((r: { cardId: string }) => r.cardId === 'card-C');
    expect(cardCResult?.error).toBeUndefined();

    expect(mocks.mockUpdateProviderSyncMetadata).toHaveBeenCalledWith(
      'card-A',
      userId,
      { providerStatus: 'ERROR' },
      expect.anything()
    );
  });
});
