import { Sequelize } from 'sequelize';
import { Card } from 'models/card.js';
import { StagedTransaction } from 'models/staged-transaction.js';
import { initModels } from 'models/init-models.js';
import { associateModels } from 'models/associations.js';

let sequelize: Sequelize;
let card: Card;

beforeEach(async () => {
  sequelize = new Sequelize('sqlite::memory:', { logging: false });
  initModels(sequelize);
  associateModels();
  await sequelize.sync({ force: true });
  card = await Card.create({
    userId: 'user-1',
    bank: 'Chase',
    alias: 'Chase Sapphire',
  });
});

describe('StagedTransaction model', () => {
  it('creates a staged transaction with all columns and applies defaults', async () => {
    const staged = await StagedTransaction.create({
      userId: 'user-1',
      cardId: card.id,
      provider: 'teller',
      providerTransactionId: 'txn-1',
      description: 'AMAZON.COM*1AB23',
      total: 42.5,
      transactionDate: new Date('2026-08-01'),
    });

    expect(staged.id).toBeDefined();
    expect(staged.providerPending).toBe(false);
    expect(staged.reviewStatus).toBe('PENDING');
    expect(staged.suggestedSubCategoryId ?? null).toBeNull();
    expect(staged.suggestedPeriodId ?? null).toBeNull();
    expect(staged.suggestionSource ?? null).toBeNull();
    expect(staged.promotedExpenseId ?? null).toBeNull();
    expect(staged.rawPayload ?? null).toBeNull();
  });

  it('round-trips a raw payload and non-default flags', async () => {
    const staged = await StagedTransaction.create({
      userId: 'user-1',
      cardId: card.id,
      provider: 'teller',
      providerTransactionId: 'txn-2',
      description: 'STARBUCKS',
      total: 6.75,
      transactionDate: new Date('2026-08-02'),
      providerPending: true,
      suggestionSource: 'HISTORY_MATCH',
      rawPayload: { id: 'txn-2', status: 'pending' },
    });

    const reloaded = await StagedTransaction.findByPk(staged.id);

    expect(reloaded?.providerPending).toBe(true);
    expect(reloaded?.suggestionSource).toBe('HISTORY_MATCH');
    expect(reloaded?.rawPayload).toEqual({ id: 'txn-2', status: 'pending' });
  });

  it('rejects a duplicate (card_id, provider_transaction_id) pair', async () => {
    await StagedTransaction.create({
      userId: 'user-1',
      cardId: card.id,
      provider: 'teller',
      providerTransactionId: 'txn-dup',
      description: 'DUPLICATE',
      total: 10,
      transactionDate: new Date('2026-08-03'),
    });

    await expect(
      StagedTransaction.create({
        userId: 'user-1',
        cardId: card.id,
        provider: 'teller',
        providerTransactionId: 'txn-dup',
        description: 'DUPLICATE AGAIN',
        total: 11,
        transactionDate: new Date('2026-08-04'),
      })
    ).rejects.toThrow();
  });

  it('allows the same provider_transaction_id on two different cards', async () => {
    const otherCard = await Card.create({
      userId: 'user-1',
      bank: 'BofA',
      alias: 'BofA Checking',
    });

    await StagedTransaction.create({
      userId: 'user-1',
      cardId: card.id,
      provider: 'teller',
      providerTransactionId: 'shared-txn-id',
      description: 'SHARED',
      total: 5,
      transactionDate: new Date('2026-08-05'),
    });

    await expect(
      StagedTransaction.create({
        userId: 'user-1',
        cardId: otherCard.id,
        provider: 'teller',
        providerTransactionId: 'shared-txn-id',
        description: 'SHARED',
        total: 5,
        transactionDate: new Date('2026-08-05'),
      })
    ).resolves.toBeDefined();
  });
});
