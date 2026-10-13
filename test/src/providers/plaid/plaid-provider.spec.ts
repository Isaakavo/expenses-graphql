import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createHash, randomUUID } from 'crypto';
import { SignJWT, exportJWK, generateKeyPair } from 'jose';

const createLinkToken = vi.fn();
const exchangePublicToken = vi.fn();
const getAccounts = vi.fn();
const syncTransactions = vi.fn();
const getWebhookVerificationKey = vi.fn();

vi.mock('../../../../src/providers/plaid/plaid-client.js', () => ({
  createLinkToken,
  exchangePublicToken,
  getAccounts,
  syncTransactions,
  getWebhookVerificationKey,
}));

type PlaidProviderModule = typeof import('../../../../src/providers/plaid/plaid-provider.js');

const loadProviderModule = async (): Promise<PlaidProviderModule> => {
  vi.resetModules();
  return import('../../../../src/providers/plaid/plaid-provider.js');
};

let plaidProvider: PlaidProviderModule['plaidProvider'];
let FETCH_BUDGET_MAX: PlaidProviderModule['WEBHOOK_KEY_FETCH_BUDGET_MAX'];
let FETCH_BUDGET_WINDOW_MS: PlaidProviderModule['WEBHOOK_KEY_FETCH_BUDGET_WINDOW_MS'];
let MAX_CACHED_KEYS: PlaidProviderModule['MAX_CACHED_KEYS'];

beforeEach(async () => {
  vi.clearAllMocks();
  const mod = await loadProviderModule();
  plaidProvider = mod.plaidProvider;
  FETCH_BUDGET_MAX = mod.WEBHOOK_KEY_FETCH_BUDGET_MAX;
  FETCH_BUDGET_WINDOW_MS = mod.WEBHOOK_KEY_FETCH_BUDGET_WINDOW_MS;
  MAX_CACHED_KEYS = mod.MAX_CACHED_KEYS;
});

const buildSignedWebhook = async (body: Record<string, unknown>) => {
  const rawBody = JSON.stringify(body);
  const kid = randomUUID();
  const { publicKey, privateKey } = await generateKeyPair('ES256');
  const jwk = await exportJWK(publicKey);
  const publicJwk = { ...jwk, kid, alg: 'ES256', use: 'sig' };

  const requestBodySha256 = createHash('sha256').update(rawBody).digest('hex');
  const token = await new SignJWT({ request_body_sha256: requestBodySha256 })
    .setProtectedHeader({ alg: 'ES256', kid })
    .setIssuedAt()
    .sign(privateKey);

  return { rawBody, kid, publicJwk, token };
};

describe('plaid-provider.listAccounts', () => {
  it('maps each account against the shared item', async () => {
    getAccounts.mockResolvedValue({
      accounts: [
        { account_id: 'acct-1', mask: '1111' },
        { account_id: 'acct-2', mask: '2222' },
      ],
      item: { item_id: 'item-1', institution_name: 'Chase' },
    });

    const result = await plaidProvider.listAccounts('access-token-abc');

    expect(result).toEqual([
      {
        providerAccountId: 'acct-1',
        providerConnectionId: 'item-1',
        institutionName: 'Chase',
        last4: '1111',
      },
      {
        providerAccountId: 'acct-2',
        providerConnectionId: 'item-1',
        institutionName: 'Chase',
        last4: '2222',
      },
    ]);
    expect(getAccounts).toHaveBeenCalledWith('access-token-abc');
  });
});

describe('plaid-provider.createLinkSession', () => {
  it('returns the link_token from the client response', async () => {
    createLinkToken.mockResolvedValue({ link_token: 'link-token-abc' });

    const result = await plaidProvider.createLinkSession({ userId: 'user-1' });

    expect(result).toEqual({ linkToken: 'link-token-abc' });
    expect(createLinkToken).toHaveBeenCalledWith('user-1');
  });

  it('propagates a client error', async () => {
    createLinkToken.mockRejectedValue(new Error('Plaid down'));

    await expect(
      plaidProvider.createLinkSession({ userId: 'user-1' })
    ).rejects.toThrow('Plaid down');
  });
});

describe('plaid-provider.exchangeToken', () => {
  it('returns accessToken and providerConnectionId from the exchange response', async () => {
    exchangePublicToken.mockResolvedValue({
      access_token: 'access-token-abc',
      item_id: 'item-abc',
    });

    const result = await plaidProvider.exchangeToken('public-token-xyz');

    expect(result).toEqual({
      accessToken: 'access-token-abc',
      providerConnectionId: 'item-abc',
    });
    expect(exchangePublicToken).toHaveBeenCalledWith('public-token-xyz');
  });

  it('propagates a client error (e.g. expired public_token)', async () => {
    exchangePublicToken.mockRejectedValue(new Error('invalid public_token'));

    await expect(plaidProvider.exchangeToken('bad-token')).rejects.toThrow(
      'invalid public_token'
    );
  });
});

describe('plaid-provider.listTransactions', () => {
  it('maps a single syncTransactions call straight through mapSyncResult', async () => {
    syncTransactions.mockResolvedValue({
      added: [],
      modified: [],
      removed: [],
      next_cursor: 'cursor-1',
      has_more: false,
    });

    const result = await plaidProvider.listTransactions({
      accessToken: 'access-token-abc',
      cursor: null,
    });

    expect(result).toEqual({
      transactions: [],
      removedProviderTransactionIds: [],
      nextCursor: 'cursor-1',
      hasMore: false,
    });
  });

  it('passes a null cursor through as-is', async () => {
    syncTransactions.mockResolvedValue({
      added: [],
      modified: [],
      removed: [],
      next_cursor: 'cursor-1',
      has_more: false,
    });

    await plaidProvider.listTransactions({ accessToken: 'access-token', cursor: null });

    expect(syncTransactions).toHaveBeenCalledWith('access-token', null);
  });

  it('makes exactly one client call per invocation, regardless of hasMore', async () => {
    syncTransactions.mockResolvedValue({
      added: [],
      modified: [],
      removed: [],
      next_cursor: 'cursor-2',
      has_more: true,
    });

    await plaidProvider.listTransactions({ accessToken: 'access-token', cursor: 'cursor-1' });

    expect(syncTransactions).toHaveBeenCalledTimes(1);
  });
});

describe('plaid-provider.verifyWebhookSignature', () => {
  it('returns true for a valid JWT signed by a currently cached key, and does not re-fetch on a second call with the same kid', async () => {
    const { rawBody, kid, publicJwk, token } = await buildSignedWebhook({
      webhook_type: 'TRANSACTIONS',
      webhook_code: 'SYNC_UPDATES_AVAILABLE',
      item_id: 'item-1',
    });
    getWebhookVerificationKey.mockResolvedValue({ key: publicJwk });

    const first = await plaidProvider.verifyWebhookSignature({
      rawBody,
      headers: { 'plaid-verification': token },
    });
    const second = await plaidProvider.verifyWebhookSignature({
      rawBody,
      headers: { 'plaid-verification': token },
    });

    expect(first).toBe(true);
    expect(second).toBe(true);
    expect(getWebhookVerificationKey).toHaveBeenCalledTimes(1);
    expect(getWebhookVerificationKey).toHaveBeenCalledWith(kid);
  });

  it('returns false for a tampered payload (rawBody does not match what was signed)', async () => {
    const { kid, publicJwk, token } = await buildSignedWebhook({
      webhook_type: 'ITEM',
      webhook_code: 'ERROR',
      item_id: 'item-2',
    });
    getWebhookVerificationKey.mockResolvedValue({ key: publicJwk });

    const result = await plaidProvider.verifyWebhookSignature({
      rawBody: JSON.stringify({ tampered: true }),
      headers: { 'plaid-verification': token },
    });

    expect(result).toBe(false);
    expect(kid).toBeTruthy();
  });

  it('returns false when request_body_sha256 does not match the actual raw body', async () => {
    const rawBody = JSON.stringify({ webhook_type: 'ITEM', webhook_code: 'ERROR' });
    const kid = randomUUID();
    const { publicKey, privateKey } = await generateKeyPair('ES256');
    const jwk = await exportJWK(publicKey);
    const publicJwk = { ...jwk, kid, alg: 'ES256', use: 'sig' };
    getWebhookVerificationKey.mockResolvedValue({ key: publicJwk });

    const token = await new SignJWT({ request_body_sha256: 'not-the-real-hash' })
      .setProtectedHeader({ alg: 'ES256', kid })
      .setIssuedAt()
      .sign(privateKey);

    const result = await plaidProvider.verifyWebhookSignature({
      rawBody,
      headers: { 'plaid-verification': token },
    });

    expect(result).toBe(false);
  });

  it('returns false and never throws for malformed rawBody/headers', async () => {
    await expect(
      plaidProvider.verifyWebhookSignature({ rawBody: 'not json', headers: {} })
    ).resolves.toBe(false);

    await expect(
      plaidProvider.verifyWebhookSignature({
        rawBody: 'not json',
        headers: { 'plaid-verification': 'not-a-jwt' },
      })
    ).resolves.toBe(false);
  });

  it('returns false for a correctly-signed JWT whose iat is ~1 year old', async () => {
    const body = { webhook_type: 'ITEM', webhook_code: 'ERROR', item_id: 'item-old' };
    const rawBody = JSON.stringify(body);
    const kid = randomUUID();
    const { publicKey, privateKey } = await generateKeyPair('ES256');
    const jwk = await exportJWK(publicKey);
    const publicJwk = { ...jwk, kid, alg: 'ES256', use: 'sig' };
    getWebhookVerificationKey.mockResolvedValue({ key: publicJwk });

    const oneYearAgo = Math.floor(Date.now() / 1000) - 60 * 60 * 24 * 365;
    const requestBodySha256 = createHash('sha256').update(rawBody).digest('hex');
    const token = await new SignJWT({ request_body_sha256: requestBodySha256 })
      .setProtectedHeader({ alg: 'ES256', kid })
      .setIssuedAt(oneYearAgo)
      .sign(privateKey);

    const result = await plaidProvider.verifyWebhookSignature({
      rawBody,
      headers: { 'plaid-verification': token },
    });

    expect(result).toBe(false);
  });

  it('does not re-fetch a repeated bogus kid (bounds fetch rate against attacker-driven cache misses)', async () => {
    const kid = randomUUID();
    getWebhookVerificationKey.mockRejectedValue(new Error('key not found'));

    const rawBody = JSON.stringify({ webhook_type: 'ITEM', webhook_code: 'ERROR' });
    const { privateKey } = await generateKeyPair('ES256');
    const token = await new SignJWT({ request_body_sha256: 'irrelevant' })
      .setProtectedHeader({ alg: 'ES256', kid })
      .setIssuedAt()
      .sign(privateKey);

    await plaidProvider.verifyWebhookSignature({
      rawBody,
      headers: { 'plaid-verification': token },
    });
    await plaidProvider.verifyWebhookSignature({
      rawBody,
      headers: { 'plaid-verification': token },
    });
    await plaidProvider.verifyWebhookSignature({
      rawBody,
      headers: { 'plaid-verification': token },
    });

    expect(getWebhookVerificationKey).toHaveBeenCalledTimes(1);
  });

  it('treats an expired cached key as a miss and re-fetches for the same kid', async () => {
    const kid = randomUUID();
    const { publicKey: oldPublicKey, privateKey: oldPrivateKey } = await generateKeyPair('ES256');
    const { publicKey: newPublicKey, privateKey: newPrivateKey } = await generateKeyPair('ES256');
    const oldJwk = await exportJWK(oldPublicKey);
    const newJwk = await exportJWK(newPublicKey);
    const expiredJwk = {
      ...oldJwk,
      kid,
      alg: 'ES256',
      use: 'sig',
      expired_at: Math.floor(Date.now() / 1000) - 60,
    };
    const freshJwk = { ...newJwk, kid, alg: 'ES256', use: 'sig', expired_at: null };

    getWebhookVerificationKey
      .mockResolvedValueOnce({ key: expiredJwk })
      .mockResolvedValueOnce({ key: freshJwk });

    const rawBodyOne = JSON.stringify({
      webhook_type: 'ITEM',
      webhook_code: 'ERROR',
      item_id: 'item-1',
    });
    const hashOne = createHash('sha256').update(rawBodyOne).digest('hex');
    const tokenOne = await new SignJWT({ request_body_sha256: hashOne })
      .setProtectedHeader({ alg: 'ES256', kid })
      .setIssuedAt()
      .sign(oldPrivateKey);

    const firstResult = await plaidProvider.verifyWebhookSignature({
      rawBody: rawBodyOne,
      headers: { 'plaid-verification': tokenOne },
    });
    expect(firstResult).toBe(true);

    const rawBodyTwo = JSON.stringify({
      webhook_type: 'ITEM',
      webhook_code: 'ERROR',
      item_id: 'item-2',
    });
    const hashTwo = createHash('sha256').update(rawBodyTwo).digest('hex');
    const tokenTwo = await new SignJWT({ request_body_sha256: hashTwo })
      .setProtectedHeader({ alg: 'ES256', kid })
      .setIssuedAt()
      .sign(newPrivateKey);

    const secondResult = await plaidProvider.verifyWebhookSignature({
      rawBody: rawBodyTwo,
      headers: { 'plaid-verification': tokenTwo },
    });
    expect(secondResult).toBe(true);

    expect(getWebhookVerificationKey).toHaveBeenCalledTimes(2);
  });

  it('returns false for a JWT signed by an attacker keypair when the fetched JWK is the legitimate public key', async () => {
    const body = { webhook_type: 'ITEM', webhook_code: 'ERROR', item_id: 'item-attack' };
    const rawBody = JSON.stringify(body);
    const kid = randomUUID();
    const { publicKey: legitimatePublicKey } = await generateKeyPair('ES256');
    const { privateKey: attackerPrivateKey } = await generateKeyPair('ES256');
    const jwk = await exportJWK(legitimatePublicKey);
    const publicJwk = { ...jwk, kid, alg: 'ES256', use: 'sig' };
    getWebhookVerificationKey.mockResolvedValue({ key: publicJwk });

    const requestBodySha256 = createHash('sha256').update(rawBody).digest('hex');
    const token = await new SignJWT({ request_body_sha256: requestBodySha256 })
      .setProtectedHeader({ alg: 'ES256', kid })
      .setIssuedAt()
      .sign(attackerPrivateKey);

    const result = await plaidProvider.verifyWebhookSignature({
      rawBody,
      headers: { 'plaid-verification': token },
    });

    expect(result).toBe(false);
  });

  it('bounds outbound fetches to the global budget when an attacker rotates far more distinct bogus kids than any cache can hold (rotating-kid amplification regression)', async () => {
    getWebhookVerificationKey.mockRejectedValue(new Error('key not found'));

    const rawBody = JSON.stringify({ webhook_type: 'ITEM', webhook_code: 'ERROR' });
    const { privateKey } = await generateKeyPair('ES256');
    const kids = [...Array(30).keys()].map(() => randomUUID());
    const tokens = await Promise.all(
      kids.map((kid) =>
        new SignJWT({ request_body_sha256: 'irrelevant' })
          .setProtectedHeader({ alg: 'ES256', kid })
          .setIssuedAt()
          .sign(privateKey)
      )
    );
    const rotatingRequests = [0, 1, 2].flatMap(() => tokens);

    await rotatingRequests.reduce(
      (previous, token) =>
        previous.then(() =>
          plaidProvider.verifyWebhookSignature({
            rawBody,
            headers: { 'plaid-verification': token },
          })
        ),
      Promise.resolve(false)
    );

    expect(rotatingRequests).toHaveLength(90);
    expect(getWebhookVerificationKey).toHaveBeenCalledTimes(FETCH_BUDGET_MAX);
    expect(getWebhookVerificationKey.mock.calls.length).toBeLessThan(90);
  });

  it('rejects further unknown kids without fetching once the budget is exhausted, and never throws', async () => {
    getWebhookVerificationKey.mockRejectedValue(new Error('key not found'));

    const rawBody = JSON.stringify({ webhook_type: 'ITEM', webhook_code: 'ERROR' });
    const { privateKey } = await generateKeyPair('ES256');
    const buildToken = (kid: string) =>
      new SignJWT({ request_body_sha256: 'irrelevant' })
        .setProtectedHeader({ alg: 'ES256', kid })
        .setIssuedAt()
        .sign(privateKey);

    const exhaustingKids = [...Array(FETCH_BUDGET_MAX).keys()].map(() => randomUUID());
    await exhaustingKids.reduce(
      (previous, kid) =>
        previous.then(async () => {
          const token = await buildToken(kid);
          await plaidProvider.verifyWebhookSignature({
            rawBody,
            headers: { 'plaid-verification': token },
          });
        }),
      Promise.resolve()
    );

    expect(getWebhookVerificationKey).toHaveBeenCalledTimes(FETCH_BUDGET_MAX);

    const newKidToken = await buildToken(randomUUID());
    const result = await plaidProvider.verifyWebhookSignature({
      rawBody,
      headers: { 'plaid-verification': newKidToken },
    });

    expect(result).toBe(false);
    expect(getWebhookVerificationKey).toHaveBeenCalledTimes(FETCH_BUDGET_MAX);
  });

  it('keeps a frequently used legitimate key cached (LRU) despite churn from many other successful fetches', async () => {
    const hotKid = randomUUID();
    const { publicKey: hotPublicKey, privateKey: hotPrivateKey } = await generateKeyPair('ES256');
    const hotJwk = { ...(await exportJWK(hotPublicKey)), kid: hotKid, alg: 'ES256', use: 'sig' };

    const churnCount = MAX_CACHED_KEYS + 5;
    const churnEntries = await Promise.all(
      [...Array(churnCount).keys()].map(async () => {
        const kid = randomUUID();
        const { publicKey, privateKey } = await generateKeyPair('ES256');
        const jwk = { ...(await exportJWK(publicKey)), kid, alg: 'ES256', use: 'sig' };
        return { kid, jwk, privateKey };
      })
    );

    const jwkByKid = new Map<string, unknown>([
      [hotKid, hotJwk],
      ...churnEntries.map((entry) => [entry.kid, entry.jwk] as const),
    ]);
    getWebhookVerificationKey.mockImplementation(async (kid: string) => ({
      key: jwkByKid.get(kid),
    }));

    const buildRequest = async (kid: string, privateKey: Awaited<ReturnType<typeof generateKeyPair>>['privateKey']) => {
      const body = { webhook_type: 'ITEM', webhook_code: 'ERROR', item_id: 'item-x' };
      const rawBody = JSON.stringify(body);
      const requestBodySha256 = createHash('sha256').update(rawBody).digest('hex');
      const token = await new SignJWT({ request_body_sha256: requestBodySha256 })
        .setProtectedHeader({ alg: 'ES256', kid })
        .setIssuedAt()
        .sign(privateKey);
      return { rawBody, token };
    };

    vi.useFakeTimers();
    try {
      const seedRequest = await buildRequest(hotKid, hotPrivateKey);
      const seedResult = await plaidProvider.verifyWebhookSignature({
        rawBody: seedRequest.rawBody,
        headers: { 'plaid-verification': seedRequest.token },
      });
      expect(seedResult).toBe(true);

      vi.advanceTimersByTime(FETCH_BUDGET_WINDOW_MS);

      await churnEntries.reduce(
        (previous, entry, index) =>
          previous.then(async () => {
            if (index > 0 && index % FETCH_BUDGET_MAX === 0) {
              vi.advanceTimersByTime(FETCH_BUDGET_WINDOW_MS);
            }

            const churnRequest = await buildRequest(entry.kid, entry.privateKey);
            const churnResult = await plaidProvider.verifyWebhookSignature({
              rawBody: churnRequest.rawBody,
              headers: { 'plaid-verification': churnRequest.token },
            });
            expect(churnResult).toBe(true);

            const hotTouch = await buildRequest(hotKid, hotPrivateKey);
            const hotTouchResult = await plaidProvider.verifyWebhookSignature({
              rawBody: hotTouch.rawBody,
              headers: { 'plaid-verification': hotTouch.token },
            });
            expect(hotTouchResult).toBe(true);
          }),
        Promise.resolve()
      );
    } finally {
      vi.useRealTimers();
    }

    const hotKidFetchCalls = getWebhookVerificationKey.mock.calls.filter(
      ([kid]) => kid === hotKid
    );
    expect(hotKidFetchCalls).toHaveLength(1);
  });
});

describe('plaid-provider.parseWebhookPayload', () => {
  it('returns the mapped event for a validly-signed payload', async () => {
    const { rawBody, publicJwk, token } = await buildSignedWebhook({
      webhook_type: 'TRANSACTIONS',
      webhook_code: 'SYNC_UPDATES_AVAILABLE',
      item_id: 'item-3',
    });
    getWebhookVerificationKey.mockResolvedValue({ key: publicJwk });

    const result = await plaidProvider.parseWebhookPayload({
      rawBody,
      headers: { 'plaid-verification': token },
    });

    expect(result).toEqual({
      type: 'TRANSACTIONS_UPDATED',
      providerConnectionId: 'item-3',
    });
  });

  it('returns UNKNOWN without throwing when verification fails', async () => {
    const result = await plaidProvider.parseWebhookPayload({
      rawBody: 'not json',
      headers: {},
    });

    expect(result.type).toBe('UNKNOWN');
  });
});
