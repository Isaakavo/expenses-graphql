import { Sequelize } from 'sequelize';
import { initModels } from 'models/init-models.js';
import { associateModels } from 'models/associations.js';
import { Card } from 'models/card.js';
import { StagedTransaction } from 'models/staged-transaction.js';
import { StagedTransactionRepository } from 'repository/staged-transaction-repository.js';

let sequelize: Sequelize;
let repository: StagedTransactionRepository;
let cardId: string;

const baseInput = () => ({
  userId: 'user-1',
  cardId,
  provider: 'plaid',
  providerTransactionId: 'txn-1',
  description: 'AMAZON.COM*1AB23',
  total: 42.5,
  transactionDate: new Date('2026-04-01T00:00:00Z'),
  providerPending: false,
  suggestedSubCategoryId: null,
  suggestedPeriodId: null,
  suggestionSource: null,
  rawPayload: { raw: true },
});

beforeEach(async () => {
  sequelize = new Sequelize('sqlite::memory:', { logging: false });
  initModels(sequelize);
  associateModels();
  await sequelize.sync({ force: true });
  repository = new StagedTransactionRepository();

  const card = await Card.create({ userId: 'user-1', bank: 'Chase', alias: 'Chase' });
  cardId = card.id;
});

describe('StagedTransactionRepository.upsert', () => {
  it('inserts a new row on first call', async () => {
    const { row, created, updated } = await repository.upsert(baseInput());

    expect(created).toBe(true);
    expect(updated).toBe(false);
    expect(row.providerTransactionId).toBe('txn-1');
    expect(await StagedTransaction.count()).toBe(1);
  });

  it('updates in place on a repeat call with the same (cardId, providerTransactionId)', async () => {
    await repository.upsert(baseInput());

    const { row, created, updated } = await repository.upsert({
      ...baseInput(),
      description: 'AMAZON.COM*NEW',
      total: 99.99,
    });

    expect(created).toBe(false);
    expect(updated).toBe(true);
    expect(row.description).toBe('AMAZON.COM*NEW');
    expect(Number(row.total)).toBe(99.99);
    expect(await StagedTransaction.count()).toBe(1);
  });

  it('never overwrites a row whose review_status is not PENDING', async () => {
    const { row } = await repository.upsert(baseInput());
    await row.update({ reviewStatus: 'PROMOTED' });

    const { created, updated, row: result } = await repository.upsert({
      ...baseInput(),
      description: 'should not apply',
      total: 1,
    });

    expect(created).toBe(false);
    expect(updated).toBe(false);
    expect(result.description).toBe('AMAZON.COM*1AB23');
    expect(Number(result.total)).toBe(42.5);
    expect(result.reviewStatus).toBe('PROMOTED');
  });
});

describe('StagedTransactionRepository.findByCardAndProviderTransactionId', () => {
  it('returns the matching row', async () => {
    await repository.upsert(baseInput());

    const found = await repository.findByCardAndProviderTransactionId(cardId, 'txn-1');
    expect(found?.providerTransactionId).toBe('txn-1');
  });

  it('returns null when no row matches', async () => {
    const found = await repository.findByCardAndProviderTransactionId(cardId, 'nonexistent');
    expect(found).toBeNull();
  });
});

describe('StagedTransactionRepository.updateFields', () => {
  it('updates only the given fields, leaving others untouched', async () => {
    const { row } = await repository.upsert(baseInput());
    await row.update({ reviewStatus: 'PROMOTED' });

    const updated = await repository.updateFields(row.id, {
      providerTransactionId: 'txn-1-posted',
      providerPending: false,
    });

    expect(updated.providerTransactionId).toBe('txn-1-posted');
    expect(updated.providerPending).toBe(false);
    expect(updated.reviewStatus).toBe('PROMOTED');
    expect(updated.description).toBe('AMAZON.COM*1AB23');
  });
});

describe('StagedTransactionRepository.deleteByProviderTransactionId', () => {
  it('deletes a matching PENDING row', async () => {
    await repository.upsert(baseInput());

    const deletedCount = await repository.deleteByProviderTransactionId({
      cardIds: [cardId],
      providerTransactionId: 'txn-1',
    });

    expect(deletedCount).toBe(1);
    expect(await StagedTransaction.count()).toBe(0);
  });

  it('leaves a PROMOTED row untouched', async () => {
    const { row } = await repository.upsert(baseInput());
    await row.update({ reviewStatus: 'PROMOTED' });

    const deletedCount = await repository.deleteByProviderTransactionId({
      cardIds: [cardId],
      providerTransactionId: 'txn-1',
    });

    expect(deletedCount).toBe(0);
    expect(await StagedTransaction.count()).toBe(1);
  });
});

describe('StagedTransactionRepository.findByFilter', () => {
  it('respects the cardId and reviewStatus filters and always scopes by userId', async () => {
    const otherCard = await Card.create({ userId: 'user-1', bank: 'BofA', alias: 'BofA' });

    await repository.upsert(baseInput());
    const { row: dismissedRow } = await repository.upsert({
      ...baseInput(),
      cardId: otherCard.id,
      providerTransactionId: 'txn-2',
    });
    await dismissedRow.update({ reviewStatus: 'DISMISSED' });
    await repository.upsert({
      ...baseInput(),
      userId: 'user-2',
      providerTransactionId: 'txn-3',
    });

    const allForUser1 = await repository.findByFilter({ userId: 'user-1' });
    expect(allForUser1).toHaveLength(2);

    const filteredByCard = await repository.findByFilter({ userId: 'user-1', cardId });
    expect(filteredByCard).toHaveLength(1);
    expect(filteredByCard[0].providerTransactionId).toBe('txn-1');

    const filteredByStatus = await repository.findByFilter({
      userId: 'user-1',
      reviewStatus: 'DISMISSED',
    });
    expect(filteredByStatus).toHaveLength(1);
    expect(filteredByStatus[0].providerTransactionId).toBe('txn-2');
  });
});

describe('StagedTransactionRepository.findById', () => {
  it('returns the row scoped by userId', async () => {
    const { row } = await repository.upsert(baseInput());

    const found = await repository.findById(row.id, 'user-1');
    expect(found?.id).toBe(row.id);

    const notFoundForOtherUser = await repository.findById(row.id, 'user-2');
    expect(notFoundForOtherUser).toBeNull();
  });

  it('does not eager-load the card\'s provider token ciphertext fields', async () => {
    await Card.update(
      {
        providerAccessTokenCiphertext: 'secret-ciphertext',
        providerAccessTokenIv: 'secret-iv',
        providerAccessTokenAuthTag: 'secret-authtag',
      },
      { where: { id: cardId } }
    );
    const { row } = await repository.upsert(baseInput());

    const found = await repository.findById(row.id, 'user-1');

    const cardKeys = Object.keys(found?.get({ plain: true }).card ?? {});
    expect(cardKeys).not.toContain('providerAccessTokenCiphertext');
    expect(cardKeys).not.toContain('providerAccessTokenIv');
    expect(cardKeys).not.toContain('providerAccessTokenAuthTag');
  });
});
