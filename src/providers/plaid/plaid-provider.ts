import { createHash } from 'crypto';
import { decodeProtectedHeader, importJWK, jwtVerify, JWK, JWTPayload } from 'jose';
import { JWKPublicKey } from 'plaid';
import {
  createLinkToken,
  exchangePublicToken,
  getAccounts,
  getWebhookVerificationKey,
  syncTransactions,
} from './plaid-client.js';
import { mapAccount, mapSyncResult, mapWebhookPayload } from './plaid-mapper.js';
import { logger } from '../../logger.js';
import { ProviderWebhookEvent, TransactionProvider } from '../provider.types.js';

const PLAID_VERIFICATION_HEADER = 'plaid-verification';
export const MAX_CACHED_KEYS = 20;
const FAILED_KID_CACHE_TTL_MS = 60_000;
export const WEBHOOK_KEY_FETCH_BUDGET_MAX = 5;
export const WEBHOOK_KEY_FETCH_BUDGET_WINDOW_MS = 60_000;

const webhookKeyCache = new Map<string, JWKPublicKey>();
const failedKidCache = new Map<string, number>();
const inFlightFetches = new Map<string, Promise<JWKPublicKey>>();

let fetchBudgetWindowStart = Date.now();
let fetchBudgetUsed = 0;

type VerifiedPayload = JWTPayload & { request_body_sha256?: string };

const findVerificationToken = (
  headers: Record<string, string>
): string | undefined => {
  const headerKey = Object.keys(headers ?? {}).find(
    (key) => key.toLowerCase() === PLAID_VERIFICATION_HEADER
  );
  return headerKey ? headers[headerKey] : undefined;
};

const evictOldestIfFull = (cache: Map<string, unknown>, maxSize: number): void => {
  if (cache.size < maxSize) {
    return;
  }
  const oldestKey = cache.keys().next().value;
  cache.delete(oldestKey);
};

const isFetchRecentlyFailed = (kid: string): boolean => {
  const failedAt = failedKidCache.get(kid);
  if (failedAt === undefined) {
    return false;
  }
  if (Date.now() - failedAt > FAILED_KID_CACHE_TTL_MS) {
    failedKidCache.delete(kid);
    return false;
  }
  return true;
};

const isExpired = (jwk: JWKPublicKey): boolean =>
  jwk.expired_at !== null && jwk.expired_at !== undefined && jwk.expired_at * 1000 <= Date.now();

const kidFingerprint = (kid: string): string =>
  createHash('sha256').update(kid).digest('hex').slice(0, 8);

const hasFetchBudget = (): boolean => {
  const now = Date.now();
  if (now - fetchBudgetWindowStart >= WEBHOOK_KEY_FETCH_BUDGET_WINDOW_MS) {
    fetchBudgetWindowStart = now;
    fetchBudgetUsed = 0;
  }
  return fetchBudgetUsed < WEBHOOK_KEY_FETCH_BUDGET_MAX;
};

const fetchAndCacheKey = async (kid: string): Promise<JWKPublicKey> => {
  try {
    const { key } = await getWebhookVerificationKey(kid);
    evictOldestIfFull(webhookKeyCache, MAX_CACHED_KEYS);
    webhookKeyCache.set(kid, key);
    return key;
  } catch (error) {
    evictOldestIfFull(failedKidCache, MAX_CACHED_KEYS);
    failedKidCache.set(kid, Date.now());
    throw error;
  } finally {
    inFlightFetches.delete(kid);
  }
};

const getCachedVerificationKey = async (kid: string): Promise<JWKPublicKey | null> => {
  const cached = webhookKeyCache.get(kid);
  if (cached && !isExpired(cached)) {
    webhookKeyCache.delete(kid);
    webhookKeyCache.set(kid, cached);
    return cached;
  }
  if (cached) {
    webhookKeyCache.delete(kid);
  }
  if (isFetchRecentlyFailed(kid)) {
    return null;
  }

  const inFlight = inFlightFetches.get(kid);
  if (inFlight) {
    return inFlight;
  }

  if (!hasFetchBudget()) {
    logger.warn(`Plaid webhook verification key fetch budget exhausted (kid ${kidFingerprint(kid)})`);
    return null;
  }
  fetchBudgetUsed += 1;

  const fetchPromise = fetchAndCacheKey(kid);
  inFlightFetches.set(kid, fetchPromise);
  return fetchPromise;
};

const verifyAndDecode = async (
  rawBody: string,
  headers: Record<string, string>
): Promise<VerifiedPayload | null> => {
  try {
    const token = findVerificationToken(headers);
    if (!token) {
      return null;
    }

    const { kid } = decodeProtectedHeader(token);
    if (!kid) {
      return null;
    }

    const jwk = await getCachedVerificationKey(kid);
    if (!jwk) {
      return null;
    }
    const key = await importJWK(jwk as unknown as JWK, 'ES256');
    const { payload } = await jwtVerify<VerifiedPayload>(token, key, {
      algorithms: ['ES256'],
      maxTokenAge: '5m',
    });

    const actualHash = createHash('sha256').update(rawBody).digest('hex');
    if (payload.request_body_sha256 !== actualHash) {
      return null;
    }

    return payload;
  } catch (error) {
    logger.warn(`Plaid webhook verification failed: ${error.message}`);
    return null;
  }
};

const listAccounts: TransactionProvider['listAccounts'] = async (accessToken) => {
  const response = await getAccounts(accessToken);
  return response.accounts.map((account) => mapAccount(account, response.item));
};

const createLinkSession: TransactionProvider['createLinkSession'] = async ({
  userId,
}) => {
  const response = await createLinkToken(userId);
  return { linkToken: response.link_token };
};

const exchangeToken: TransactionProvider['exchangeToken'] = async (rawToken) => {
  const response = await exchangePublicToken(rawToken);
  return {
    accessToken: response.access_token,
    providerConnectionId: response.item_id,
  };
};

const listTransactions: TransactionProvider['listTransactions'] = async ({
  accessToken,
  cursor,
}) => {
  const response = await syncTransactions(accessToken, cursor);
  return mapSyncResult(response);
};

const verifyWebhookSignature: TransactionProvider['verifyWebhookSignature'] = async ({
  rawBody,
  headers,
}) => {
  const payload = await verifyAndDecode(rawBody, headers);
  return payload !== null;
};

const parseWebhookPayload: TransactionProvider['parseWebhookPayload'] = async ({
  rawBody,
  headers,
}): Promise<ProviderWebhookEvent> => {
  const payload = await verifyAndDecode(rawBody, headers);
  if (!payload) {
    return { type: 'UNKNOWN', raw: null };
  }

  try {
    return mapWebhookPayload(JSON.parse(rawBody));
  } catch (error) {
    logger.warn(`Failed to parse Plaid webhook body: ${error.message}`);
    return { type: 'UNKNOWN', raw: rawBody };
  }
};

export const plaidProvider: TransactionProvider = {
  name: 'plaid',
  listAccounts,
  createLinkSession,
  exchangeToken,
  listTransactions,
  verifyWebhookSignature,
  parseWebhookPayload,
};
