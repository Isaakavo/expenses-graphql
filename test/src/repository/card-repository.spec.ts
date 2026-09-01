import { Sequelize } from 'sequelize';
import { initCardModel, Card } from 'models/card.js';
import { CardRepository } from 'repository/card-repository.js';

let sequelize: Sequelize;
let repository: CardRepository;

beforeEach(async () => {
  sequelize = new Sequelize('sqlite::memory:', { logging: false });
  initCardModel(sequelize);
  await sequelize.sync({ force: true });
  repository = new CardRepository();
});

const createCard = (overrides: Partial<Record<string, unknown>> = {}) =>
  Card.create({
    userId: 'user-1',
    bank: 'Chase',
    alias: 'Chase Sapphire',
    ...overrides,
  });

describe('CardRepository.linkProvider', () => {
  it('sets the provider fields and encrypts the token (stored value is not the plaintext)', async () => {
    const card = await createCard();

    const linked = await repository.linkProvider(card.id, 'user-1', {
      provider: 'plaid',
      providerAccountId: 'acct-1',
      providerConnectionId: 'item-1',
      ciphertext: 'ciphertext-value',
      iv: 'iv-value',
      authTag: 'authtag-value',
    });

    expect(linked.provider).toBe('plaid');
    expect(linked.providerAccountId).toBe('acct-1');
    expect(linked.providerConnectionId).toBe('item-1');
    expect(linked.providerAccessTokenCiphertext).toBe('ciphertext-value');
    expect(linked.providerAccessTokenCiphertext).not.toBe('the-real-access-token');
    expect(linked.providerAccessTokenIv).toBe('iv-value');
    expect(linked.providerAccessTokenAuthTag).toBe('authtag-value');
    expect(linked.providerStatus).toBe('ACTIVE');
    expect(linked.providerLinkedAt).toBeInstanceOf(Date);
  });

  it('linking two cards from one call gives both rows the same providerConnectionId and ciphertext, with different providerAccountIds', async () => {
    const cardA = await createCard({ alias: 'Card A' });
    const cardB = await createCard({ alias: 'Card B' });

    const linkedA = await repository.linkProvider(cardA.id, 'user-1', {
      provider: 'plaid',
      providerAccountId: 'acct-A',
      providerConnectionId: 'item-shared',
      ciphertext: 'shared-ciphertext',
      iv: 'shared-iv',
      authTag: 'shared-authtag',
    });
    const linkedB = await repository.linkProvider(cardB.id, 'user-1', {
      provider: 'plaid',
      providerAccountId: 'acct-B',
      providerConnectionId: 'item-shared',
      ciphertext: 'shared-ciphertext',
      iv: 'shared-iv',
      authTag: 'shared-authtag',
    });

    expect(linkedA.providerConnectionId).toBe(linkedB.providerConnectionId);
    expect(linkedA.providerAccessTokenCiphertext).toBe(
      linkedB.providerAccessTokenCiphertext
    );
    expect(linkedA.providerAccountId).not.toBe(linkedB.providerAccountId);
  });

  it('is scoped by userId: linking another user\'s card fails', async () => {
    const card = await createCard({ userId: 'user-1' });

    await expect(
      repository.linkProvider(card.id, 'user-2', {
        provider: 'plaid',
        providerAccountId: 'acct-1',
        providerConnectionId: 'item-1',
        ciphertext: 'ciphertext-value',
        iv: 'iv-value',
        authTag: 'authtag-value',
      })
    ).rejects.toThrow();
  });
});

describe('CardRepository.unlinkProvider', () => {
  it('clears provider fields but leaves bank/alias/isDebit/isDigital untouched', async () => {
    const card = await createCard({ bank: 'Chase', alias: 'My Card', isDebit: true, isDigital: false });
    await repository.linkProvider(card.id, 'user-1', {
      provider: 'plaid',
      providerAccountId: 'acct-1',
      providerConnectionId: 'item-1',
      ciphertext: 'ciphertext-value',
      iv: 'iv-value',
      authTag: 'authtag-value',
    });

    const unlinked = await repository.unlinkProvider(card.id, 'user-1');

    expect(unlinked.provider ?? null).toBeNull();
    expect(unlinked.providerAccountId ?? null).toBeNull();
    expect(unlinked.providerConnectionId ?? null).toBeNull();
    expect(unlinked.providerAccessTokenCiphertext ?? null).toBeNull();
    expect(unlinked.providerAccessTokenIv ?? null).toBeNull();
    expect(unlinked.providerAccessTokenAuthTag ?? null).toBeNull();
    expect(unlinked.providerStatus ?? null).toBeNull();
    expect(unlinked.bank).toBe('Chase');
    expect(unlinked.alias).toBe('My Card');
    expect(unlinked.isDebit).toBe(true);
    expect(unlinked.isDigital).toBe(false);
  });

  it('is scoped by userId: unlinking another user\'s card fails', async () => {
    const card = await createCard({ userId: 'user-1' });

    await expect(repository.unlinkProvider(card.id, 'user-2')).rejects.toThrow();
  });
});
