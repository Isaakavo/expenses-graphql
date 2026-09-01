import {
  AccountsGetResponse,
  Configuration,
  CountryCode,
  ItemPublicTokenExchangeResponse,
  LinkTokenCreateResponse,
  PlaidApi,
  PlaidEnvironments,
  Products,
  TransactionsSyncResponse,
  WebhookVerificationKeyGetResponse,
} from 'plaid';

const REQUEST_TIMEOUT_MS = 10000;

let plaidApi: PlaidApi | undefined;

const buildClient = (): PlaidApi => {
  const clientId = process.env.PLAID_CLIENT_ID;
  const secret = process.env.PLAID_SECRET;
  const env = process.env.PLAID_ENV;

  if (!clientId || !secret) {
    throw new Error('PLAID_CLIENT_ID and PLAID_SECRET must be set');
  }

  if (!env || !Object.keys(PlaidEnvironments).includes(env)) {
    throw new Error(
      `PLAID_ENV must be one of: ${Object.keys(PlaidEnvironments).join(', ')}`
    );
  }

  return new PlaidApi(
    new Configuration({
      basePath: PlaidEnvironments[env],
      baseOptions: {
        headers: {
          'PLAID-CLIENT-ID': clientId,
          'PLAID-SECRET': secret,
        },
        timeout: REQUEST_TIMEOUT_MS,
      },
    })
  );
};

const getClient = (): PlaidApi => {
  if (!plaidApi) {
    plaidApi = buildClient();
  }
  return plaidApi;
};

export async function createLinkToken(
  userId: string
): Promise<LinkTokenCreateResponse> {
  const response = await getClient().linkTokenCreate({
    user: { client_user_id: userId },
    client_name: 'Expenses',
    products: [Products.Transactions],
    country_codes: [CountryCode.Us],
    language: 'en',
    webhook: process.env.PLAID_WEBHOOK_URL,
  });
  return response.data;
}

export async function exchangePublicToken(
  publicToken: string
): Promise<ItemPublicTokenExchangeResponse> {
  const response = await getClient().itemPublicTokenExchange({
    public_token: publicToken,
  });
  return response.data;
}

export async function getAccounts(
  accessToken: string
): Promise<AccountsGetResponse> {
  const response = await getClient().accountsGet({ access_token: accessToken });
  return response.data;
}

export async function syncTransactions(
  accessToken: string,
  cursor: string | null
): Promise<TransactionsSyncResponse> {
  const response = await getClient().transactionsSync({
    access_token: accessToken,
    cursor: cursor ?? undefined,
  });
  return response.data;
}

export async function getWebhookVerificationKey(
  keyId: string
): Promise<WebhookVerificationKeyGetResponse> {
  const response = await getClient().webhookVerificationKeyGet({ key_id: keyId });
  return response.data;
}
