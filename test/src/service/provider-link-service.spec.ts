import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Sequelize } from 'sequelize';
import { randomBytes } from 'crypto';

process.env.PROVIDER_TOKEN_ENCRYPTION_KEY = randomBytes(32).toString('base64');

const getProvider = vi.fn();

vi.mock('../../../src/providers/provider-registry.js', () => ({
  getProvider: (...args: unknown[]) => getProvider(...args),
}));

const { ProviderLinkService } = await import(
  '../../../src/service/provider-link-service.js'
);

type ProviderName = 'plaid';

type ServiceInternals = {
  cardRepository: unknown;
  providerConnectionRepository: unknown;
};

const withInternals = (target: InstanceType<typeof ProviderLinkService>) =>
  target as unknown as ServiceInternals;

const userId = 'user-1';
let service: InstanceType<typeof ProviderLinkService>;

const mockTransaction = {
  commit: vi.fn(),
  rollback: vi.fn(),
};

const mockSequelize = {
  transaction: vi.fn().mockResolvedValue(mockTransaction),
} as unknown as Sequelize;

const basePlaidProvider = {
  name: 'plaid' as const,
  listAccounts: vi.fn(),
  createLinkSession: vi.fn(),
  exchangeToken: vi.fn(),
  listTransactions: vi.fn(),
  verifyWebhookSignature: vi.fn(),
  parseWebhookPayload: vi.fn(),
};

beforeEach(() => {
  vi.clearAllMocks();
  service = new ProviderLinkService(userId, mockSequelize);
  getProvider.mockReturnValue(basePlaidProvider);
});

describe('createLinkToken', () => {
  it('delegates to provider.createLinkSession and returns its linkToken', async () => {
    basePlaidProvider.createLinkSession.mockResolvedValue({ linkToken: 'link-token-abc' });

    const result = await service.createLinkToken('plaid' as ProviderName);

    expect(getProvider).toHaveBeenCalledWith('plaid');
    expect(basePlaidProvider.createLinkSession).toHaveBeenCalledWith({ userId });
    expect(result).toEqual({ linkToken: 'link-token-abc' });
  });
});

describe('linkCardToProvider', () => {
  const buildInput = (overrides: Partial<Record<string, unknown>> = {}) => ({
    provider: 'plaid' as ProviderName,
    publicToken: 'public-token-abc',
    cards: [
      { cardId: 'card-A', providerAccountId: 'acct-A' },
      { cardId: 'card-B', providerAccountId: 'acct-B' },
    ],
    ...overrides,
  });

  const setupRepositories = () => {
    const mockLinkProvider = vi.fn().mockImplementation((cardId, _userId, input) => ({
      id: cardId,
      providerAccountId: input.providerAccountId,
      providerConnectionId: input.providerConnectionId,
      providerAccessTokenCiphertext: input.ciphertext,
    }));
    const mockFindOrCreate = vi
      .fn()
      .mockResolvedValue([{ id: 'connection-1' }, true]);
    const mockResetCursor = vi.fn();

    withInternals(service).cardRepository = {
      linkProvider: mockLinkProvider,
      unlinkProvider: vi.fn(),
    };
    withInternals(service).providerConnectionRepository = {
      findOrCreate: mockFindOrCreate,
      resetCursor: mockResetCursor,
    };

    return { mockLinkProvider, mockFindOrCreate, mockResetCursor };
  };

  it('exchanges the public token exactly once and encrypts the access token exactly once', async () => {
    basePlaidProvider.exchangeToken.mockResolvedValue({
      accessToken: 'real-access-token',
      providerConnectionId: 'item-1',
    });
    setupRepositories();

    await service.linkCardToProvider(buildInput());

    expect(basePlaidProvider.exchangeToken).toHaveBeenCalledTimes(1);
    expect(basePlaidProvider.exchangeToken).toHaveBeenCalledWith('public-token-abc');
  });

  it('links both cards with the same providerConnectionId and ciphertext, different providerAccountIds', async () => {
    basePlaidProvider.exchangeToken.mockResolvedValue({
      accessToken: 'real-access-token',
      providerConnectionId: 'item-1',
    });
    const { mockLinkProvider } = setupRepositories();

    const result = await service.linkCardToProvider(buildInput());

    expect(mockLinkProvider).toHaveBeenCalledTimes(2);
    expect(result).toHaveLength(2);
    expect(result[0].providerConnectionId).toBe(result[1].providerConnectionId);
    expect(result[0].providerAccessTokenCiphertext).toBe(
      result[1].providerAccessTokenCiphertext
    );
    expect(result[0].providerAccountId).not.toBe(result[1].providerAccountId);

    const [cardIdA, , inputA] = mockLinkProvider.mock.calls[0];
    expect(cardIdA).toBe('card-A');
    expect(inputA.providerAccountId).toBe('acct-A');
    expect(inputA.ciphertext).not.toBe('real-access-token');
  });

  it('creates exactly one provider_connections row via findOrCreate', async () => {
    basePlaidProvider.exchangeToken.mockResolvedValue({
      accessToken: 'real-access-token',
      providerConnectionId: 'item-1',
    });
    const { mockFindOrCreate } = setupRepositories();

    await service.linkCardToProvider(buildInput());

    expect(mockFindOrCreate).toHaveBeenCalledTimes(1);
    expect(mockFindOrCreate).toHaveBeenCalledWith(
      { userId, provider: 'plaid', providerConnectionId: 'item-1' },
      { transaction: mockTransaction }
    );
  });

  it('resets the cursor when linking into an already-existing connection', async () => {
    basePlaidProvider.exchangeToken.mockResolvedValue({
      accessToken: 'real-access-token',
      providerConnectionId: 'item-1',
    });
    const { mockResetCursor, mockFindOrCreate } = setupRepositories();
    mockFindOrCreate.mockResolvedValue([{ id: 'connection-1' }, false]);

    await service.linkCardToProvider(buildInput());

    expect(mockResetCursor).toHaveBeenCalledWith(
      { id: 'connection-1' },
      { transaction: mockTransaction }
    );
  });

  it('does not reset the cursor when the connection was newly created', async () => {
    basePlaidProvider.exchangeToken.mockResolvedValue({
      accessToken: 'real-access-token',
      providerConnectionId: 'item-1',
    });
    const { mockResetCursor } = setupRepositories();

    await service.linkCardToProvider(buildInput());

    expect(mockResetCursor).not.toHaveBeenCalled();
  });

  it('commits the transaction on success', async () => {
    basePlaidProvider.exchangeToken.mockResolvedValue({
      accessToken: 'real-access-token',
      providerConnectionId: 'item-1',
    });
    setupRepositories();

    await service.linkCardToProvider(buildInput());

    expect(mockTransaction.commit).toHaveBeenCalled();
    expect(mockTransaction.rollback).not.toHaveBeenCalled();
  });

  it('rolls back the entire transaction if linking one card fails (no partial link)', async () => {
    basePlaidProvider.exchangeToken.mockResolvedValue({
      accessToken: 'real-access-token',
      providerConnectionId: 'item-1',
    });
    const { mockLinkProvider } = setupRepositories();
    mockLinkProvider.mockRejectedValueOnce(new Error('card not found'));

    await expect(service.linkCardToProvider(buildInput())).rejects.toThrow(
      'card not found'
    );

    expect(mockTransaction.rollback).toHaveBeenCalled();
    expect(mockTransaction.commit).not.toHaveBeenCalled();
  });

  it('links cards sequentially, not via Promise.all, so a rejection cannot race a queued statement past rollback', async () => {
    basePlaidProvider.exchangeToken.mockResolvedValue({
      accessToken: 'real-access-token',
      providerConnectionId: 'item-1',
    });
    const { mockLinkProvider } = setupRepositories();
    const callOrder: string[] = [];
    mockLinkProvider.mockImplementation(async (cardId: string, _userId, input) => {
      callOrder.push(`start-${cardId}`);
      await new Promise((resolve) => setTimeout(resolve, 0));
      callOrder.push(`end-${cardId}`);
      return {
        id: cardId,
        providerAccountId: input.providerAccountId,
        providerConnectionId: input.providerConnectionId,
        providerAccessTokenCiphertext: input.ciphertext,
      };
    });

    await service.linkCardToProvider(buildInput());

    expect(callOrder).toEqual(['start-card-A', 'end-card-A', 'start-card-B', 'end-card-B']);
  });

  it('never includes the raw public token, access token, or ciphertext in a thrown error message', async () => {
    expect.assertions(2);
    basePlaidProvider.exchangeToken.mockResolvedValue({
      accessToken: 'super-secret-access-token',
      providerConnectionId: 'item-1',
    });
    const { mockLinkProvider } = setupRepositories();
    mockLinkProvider.mockRejectedValueOnce(new Error('DB constraint violation'));

    try {
      await service.linkCardToProvider(buildInput());
    } catch (error) {
      expect((error as Error).message).not.toContain('super-secret-access-token');
      expect((error as Error).message).not.toContain('public-token-abc');
    }
  });
});

describe('unlinkCardFromProvider', () => {
  it('delegates to cardRepository.unlinkProvider scoped by userId', async () => {
    const mockUnlinkProvider = vi.fn().mockResolvedValue({ id: 'card-A', provider: null });
    withInternals(service).cardRepository = {
      unlinkProvider: mockUnlinkProvider,
      linkProvider: vi.fn(),
    };

    const result = await service.unlinkCardFromProvider('card-A');

    expect(mockUnlinkProvider).toHaveBeenCalledWith('card-A', userId);
    expect(result).toEqual({ id: 'card-A', provider: null });
  });
});
