import { describe, it, expect } from 'vitest';
import { adaptProviderStatusToGraphql } from '../../../src/adapters/card-adapter.js';
import { ProviderConnectionStatus } from '../../../src/generated/graphql.js';

describe('adaptProviderStatusToGraphql', () => {
  it('maps ACTIVE through the lookup map', () => {
    expect(adaptProviderStatusToGraphql('ACTIVE')).toBe(ProviderConnectionStatus.ACTIVE);
  });

  it('maps PENDING_DISCONNECT through the lookup map', () => {
    expect(adaptProviderStatusToGraphql('PENDING_DISCONNECT')).toBe(
      ProviderConnectionStatus.PENDING_DISCONNECT
    );
  });

  it('maps DISCONNECTED through the lookup map', () => {
    expect(adaptProviderStatusToGraphql('DISCONNECTED')).toBe(
      ProviderConnectionStatus.DISCONNECTED
    );
  });

  it('maps ERROR through the lookup map', () => {
    expect(adaptProviderStatusToGraphql('ERROR')).toBe(ProviderConnectionStatus.ERROR);
  });

  it('returns null for an unrecognized status instead of a bad cast', () => {
    expect(adaptProviderStatusToGraphql('SOMETHING_UNKNOWN')).toBeNull();
  });

  it('returns null for null/undefined', () => {
    expect(adaptProviderStatusToGraphql(null)).toBeNull();
    expect(adaptProviderStatusToGraphql(undefined)).toBeNull();
  });
});
