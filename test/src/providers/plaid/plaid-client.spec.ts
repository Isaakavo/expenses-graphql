import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

const linkTokenCreate = vi.fn();
const itemPublicTokenExchange = vi.fn();
const accountsGet = vi.fn();
const transactionsSync = vi.fn();
const webhookVerificationKeyGet = vi.fn();
const plaidApiConstructor = vi.fn().mockImplementation(function PlaidApiMock() {
  return {
    linkTokenCreate,
    itemPublicTokenExchange,
    accountsGet,
    transactionsSync,
    webhookVerificationKeyGet,
  };
});

vi.mock('plaid', async (importOriginal) => {
  const actual = await importOriginal<typeof import('plaid')>();
  return {
    ...actual,
    PlaidApi: plaidApiConstructor,
  };
});

const ORIGINAL_ENV = { ...process.env };

const setEnv = (overrides: Record<string, string | undefined> = {}) => {
  process.env.PLAID_CLIENT_ID = overrides.PLAID_CLIENT_ID ?? 'test-client-id';
  process.env.PLAID_SECRET = overrides.PLAID_SECRET ?? 'test-secret';
  process.env.PLAID_ENV = overrides.PLAID_ENV ?? 'sandbox';
  process.env.PLAID_WEBHOOK_URL =
    overrides.PLAID_WEBHOOK_URL ?? 'https://example.com/webhooks/plaid';
};

const loadClient = async () => {
  vi.resetModules();
  return import('../../../../src/providers/plaid/plaid-client.js');
};

beforeEach(() => {
  vi.clearAllMocks();
  linkTokenCreate.mockResolvedValue({ data: { link_token: 'link-token-abc' } });
  itemPublicTokenExchange.mockResolvedValue({
    data: { access_token: 'access-token-abc', item_id: 'item-abc' },
  });
  accountsGet.mockResolvedValue({ data: { accounts: [], item: {} } });
  transactionsSync.mockResolvedValue({
    data: { added: [], modified: [], removed: [], next_cursor: 'cursor-1', has_more: false },
  });
  webhookVerificationKeyGet.mockResolvedValue({ data: { key: { kid: 'key-1' } } });
});

afterEach(() => {
  process.env = { ...ORIGINAL_ENV };
});

describe('plaid-client', () => {
  it('throws at first use when PLAID_CLIENT_ID is missing', async () => {
    setEnv();
    delete process.env.PLAID_CLIENT_ID;
    const { createLinkToken } = await loadClient();

    await expect(createLinkToken('user-1')).rejects.toThrow();
    expect(plaidApiConstructor).not.toHaveBeenCalled();
  });

  it('throws at first use when PLAID_SECRET is missing', async () => {
    setEnv();
    delete process.env.PLAID_SECRET;
    const { createLinkToken } = await loadClient();

    await expect(createLinkToken('user-1')).rejects.toThrow();
  });

  it('throws when PLAID_ENV is not sandbox or production', async () => {
    setEnv({ PLAID_ENV: 'development' });
    const { createLinkToken } = await loadClient();

    await expect(createLinkToken('user-1')).rejects.toThrow();
    expect(plaidApiConstructor).not.toHaveBeenCalled();
  });

  it('throws when PLAID_ENV matches an inherited Object.prototype key rather than an own PlaidEnvironments key', async () => {
    setEnv({ PLAID_ENV: 'toString' });
    const { createLinkToken } = await loadClient();

    await expect(createLinkToken('user-1')).rejects.toThrow();
    expect(plaidApiConstructor).not.toHaveBeenCalled();
  });

  it('does not build the SDK client at import time', async () => {
    setEnv();
    await loadClient();

    expect(plaidApiConstructor).not.toHaveBeenCalled();
  });

  it('builds the client once, lazily, on first use', async () => {
    setEnv();
    const { createLinkToken, getAccounts } = await loadClient();

    await createLinkToken('user-1');
    await getAccounts('access-token');

    expect(plaidApiConstructor).toHaveBeenCalledTimes(1);
  });

  it('configures the SDK with a non-zero request timeout', async () => {
    setEnv();
    const { createLinkToken } = await loadClient();

    await createLinkToken('user-1');

    const configuration = plaidApiConstructor.mock.calls[0][0];
    expect(configuration.baseOptions.timeout).toBeGreaterThan(0);
  });

  it('createLinkToken sends a non-empty webhook and the transactions product', async () => {
    setEnv({ PLAID_WEBHOOK_URL: 'https://example.com/webhooks/plaid' });
    const { createLinkToken } = await loadClient();

    const result = await createLinkToken('user-1');

    expect(linkTokenCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        webhook: 'https://example.com/webhooks/plaid',
        products: ['transactions'],
        user: { client_user_id: 'user-1' },
      })
    );
    expect(result.link_token).toBe('link-token-abc');
  });

  it('exchangePublicToken delegates to itemPublicTokenExchange', async () => {
    setEnv();
    const { exchangePublicToken } = await loadClient();

    const result = await exchangePublicToken('public-token-xyz');

    expect(itemPublicTokenExchange).toHaveBeenCalledWith({
      public_token: 'public-token-xyz',
    });
    expect(result.access_token).toBe('access-token-abc');
    expect(result.item_id).toBe('item-abc');
  });

  it('getAccounts delegates to accountsGet', async () => {
    setEnv();
    const { getAccounts } = await loadClient();

    await getAccounts('access-token-abc');

    expect(accountsGet).toHaveBeenCalledWith({ access_token: 'access-token-abc' });
  });

  it('syncTransactions passes a null cursor through as undefined', async () => {
    setEnv();
    const { syncTransactions } = await loadClient();

    await syncTransactions('access-token-abc', null);

    expect(transactionsSync).toHaveBeenCalledWith({
      access_token: 'access-token-abc',
      cursor: undefined,
    });
  });

  it('syncTransactions passes a real cursor through unchanged', async () => {
    setEnv();
    const { syncTransactions } = await loadClient();

    await syncTransactions('access-token-abc', 'cursor-123');

    expect(transactionsSync).toHaveBeenCalledWith({
      access_token: 'access-token-abc',
      cursor: 'cursor-123',
    });
  });

  it('getWebhookVerificationKey delegates to webhookVerificationKeyGet', async () => {
    setEnv();
    const { getWebhookVerificationKey } = await loadClient();

    await getWebhookVerificationKey('key-1');

    expect(webhookVerificationKeyGet).toHaveBeenCalledWith({ key_id: 'key-1' });
  });
});
