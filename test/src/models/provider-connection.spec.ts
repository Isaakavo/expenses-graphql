import { Sequelize } from 'sequelize';
import { ProviderConnection } from 'models/provider-connection.js';
import { initModels } from 'models/init-models.js';
import { associateModels } from 'models/associations.js';

let sequelize: Sequelize;

beforeEach(async () => {
  sequelize = new Sequelize('sqlite::memory:', { logging: false });
  initModels(sequelize);
  associateModels();
  await sequelize.sync({ force: true });
});

describe('ProviderConnection model', () => {
  it('creates a provider connection with a null sync_cursor by default', async () => {
    const connection = await ProviderConnection.create({
      userId: 'user-1',
      provider: 'plaid',
      providerConnectionId: 'item-1',
    });

    expect(connection.id).toBeDefined();
    expect(connection.syncCursor ?? null).toBeNull();
  });

  it('round-trips a sync_cursor value', async () => {
    const connection = await ProviderConnection.create({
      userId: 'user-1',
      provider: 'plaid',
      providerConnectionId: 'item-2',
      syncCursor: 'cursor-abc',
    });

    const reloaded = await ProviderConnection.findByPk(connection.id);

    expect(reloaded?.syncCursor).toBe('cursor-abc');
  });

  it('rejects a duplicate (provider, provider_connection_id) pair', async () => {
    await ProviderConnection.create({
      userId: 'user-1',
      provider: 'plaid',
      providerConnectionId: 'item-dup',
    });

    await expect(
      ProviderConnection.create({
        userId: 'user-1',
        provider: 'plaid',
        providerConnectionId: 'item-dup',
      })
    ).rejects.toThrow();
  });

  it('allows the same providerConnectionId to be referenced by two different Cards rows', async () => {
    const { Card } = await import('models/card.js');

    const cardA = await Card.create({
      userId: 'user-1',
      bank: 'Chase',
      alias: 'Chase Checking',
      providerConnectionId: 'item-shared',
    });

    const cardB = await Card.create({
      userId: 'user-1',
      bank: 'Chase',
      alias: 'Chase Credit',
      providerConnectionId: 'item-shared',
    });

    expect(cardA.providerConnectionId).toBe('item-shared');
    expect(cardB.providerConnectionId).toBe('item-shared');
  });
});
