import { plaidProvider } from './plaid/plaid-provider.js';
import { ProviderName, TransactionProvider } from './provider.types.js';

const providers: Record<ProviderName, TransactionProvider> = {
  plaid: plaidProvider,
};

export const getProvider = (name: ProviderName): TransactionProvider => {
  const provider = providers[name];
  if (!provider) {
    throw new Error(`Unknown transaction provider: ${name}`);
  }
  return provider;
};
