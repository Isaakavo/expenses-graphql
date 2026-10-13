import { describe, it, expect } from 'vitest';
import { getProvider } from '../../../src/providers/provider-registry.js';
import { plaidProvider } from '../../../src/providers/plaid/plaid-provider.js';
import { ProviderName } from '../../../src/providers/provider.types.js';

describe('provider-registry.getProvider', () => {
  it('returns the Plaid singleton for "plaid"', () => {
    expect(getProvider('plaid')).toBe(plaidProvider);
  });

  it('throws for an unknown provider name', () => {
    expect(() => getProvider('unknown' as ProviderName)).toThrow();
  });
});
