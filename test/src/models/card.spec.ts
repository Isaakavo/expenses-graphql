import { Sequelize } from 'sequelize';
import { initCardModel, Card } from 'models/card.js';

let sequelize: Sequelize;

beforeEach(async () => {
  sequelize = new Sequelize('sqlite::memory:', { logging: false });
  initCardModel(sequelize);
  await sequelize.sync({ force: true });
});

describe('Card model - provider link fields', () => {
  it('creates a card without any provider fields set', async () => {
    const card = await Card.create({
      userId: 'user-1',
      bank: 'Chase',
      alias: 'Chase Sapphire',
    });

    expect(card.provider ?? null).toBeNull();
    expect(card.providerAccountId ?? null).toBeNull();
    expect(card.providerConnectionId ?? null).toBeNull();
    expect(card.providerAccessTokenCiphertext ?? null).toBeNull();
    expect(card.providerAccessTokenIv ?? null).toBeNull();
    expect(card.providerAccessTokenAuthTag ?? null).toBeNull();
    expect(card.providerStatus ?? null).toBeNull();
    expect(card.providerLinkedAt ?? null).toBeNull();
    expect(card.providerLastSyncedAt ?? null).toBeNull();
  });

  it('round-trips all provider link fields', async () => {
    const linkedAt = new Date('2026-08-01T00:00:00.000Z');
    const syncedAt = new Date('2026-08-02T00:00:00.000Z');

    const card = await Card.create({
      userId: 'user-1',
      bank: 'Chase',
      alias: 'Chase Sapphire',
      provider: 'teller',
      providerAccountId: 'acct-123',
      providerConnectionId: 'enrollment-123',
      providerAccessTokenCiphertext: 'ciphertext-base64',
      providerAccessTokenIv: 'iv-base64',
      providerAccessTokenAuthTag: 'authtag-base64',
      providerStatus: 'ACTIVE',
      providerLinkedAt: linkedAt,
      providerLastSyncedAt: syncedAt,
    });

    const reloaded = await Card.findByPk(card.id);

    expect(reloaded?.provider).toBe('teller');
    expect(reloaded?.providerAccountId).toBe('acct-123');
    expect(reloaded?.providerConnectionId).toBe('enrollment-123');
    expect(reloaded?.providerAccessTokenCiphertext).toBe('ciphertext-base64');
    expect(reloaded?.providerAccessTokenIv).toBe('iv-base64');
    expect(reloaded?.providerAccessTokenAuthTag).toBe('authtag-base64');
    expect(reloaded?.providerStatus).toBe('ACTIVE');
    expect(reloaded?.providerLinkedAt?.toISOString()).toBe(linkedAt.toISOString());
    expect(reloaded?.providerLastSyncedAt?.toISOString()).toBe(syncedAt.toISOString());
  });

  it('enforces uniqueness on (provider, providerAccountId) when both are set', async () => {
    await Card.create({
      userId: 'user-1',
      bank: 'Chase',
      alias: 'Card A',
      provider: 'teller',
      providerAccountId: 'shared-account',
    });

    await expect(
      Card.create({
        userId: 'user-1',
        bank: 'BofA',
        alias: 'Card B',
        provider: 'teller',
        providerAccountId: 'shared-account',
      })
    ).rejects.toThrow();
  });

  it('allows multiple cards with no providerAccountId set', async () => {
    await Card.create({ userId: 'user-1', bank: 'Chase', alias: 'Card A' });

    await expect(
      Card.create({ userId: 'user-1', bank: 'BofA', alias: 'Card B' })
    ).resolves.toBeDefined();
  });
});
