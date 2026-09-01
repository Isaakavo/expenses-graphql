import { Sequelize } from 'sequelize';
import { initModels } from 'models/init-models.js';
import { associateModels } from 'models/associations.js';
import { ProviderConnection } from 'models/provider-connection.js';
import { ProviderConnectionRepository } from 'repository/provider-connection-repository.js';

let sequelize: Sequelize;
let repository: ProviderConnectionRepository;

beforeEach(async () => {
  sequelize = new Sequelize('sqlite::memory:', { logging: false });
  initModels(sequelize);
  associateModels();
  await sequelize.sync({ force: true });
  repository = new ProviderConnectionRepository();
});

describe('ProviderConnectionRepository.findOrCreate', () => {
  it('creates a new connection with a null sync_cursor when none exists', async () => {
    const [connection, created] = await repository.findOrCreate({
      userId: 'user-1',
      provider: 'plaid',
      providerConnectionId: 'item-1',
    });

    expect(created).toBe(true);
    expect(connection.syncCursor ?? null).toBeNull();
  });

  it('returns the existing row on a second call for the same (provider, providerConnectionId), not a duplicate', async () => {
    const [first] = await repository.findOrCreate({
      userId: 'user-1',
      provider: 'plaid',
      providerConnectionId: 'item-1',
    });

    const [second, created] = await repository.findOrCreate({
      userId: 'user-1',
      provider: 'plaid',
      providerConnectionId: 'item-1',
    });

    expect(created).toBe(false);
    expect(second.id).toBe(first.id);
    expect(await ProviderConnection.count()).toBe(1);
  });
});

describe('ProviderConnectionRepository.updateCursor', () => {
  it('sets sync_cursor to the given value', async () => {
    const [connection] = await repository.findOrCreate({
      userId: 'user-1',
      provider: 'plaid',
      providerConnectionId: 'item-1',
    });

    await repository.updateCursor({ id: connection.id, cursor: 'cursor-abc' });

    const reloaded = await ProviderConnection.findByPk(connection.id);
    expect(reloaded?.syncCursor).toBe('cursor-abc');
  });
});

describe('ProviderConnectionRepository.resetCursor', () => {
  it('sets sync_cursor back to null so a subsequent sync requests full history', async () => {
    const [connection] = await repository.findOrCreate({
      userId: 'user-1',
      provider: 'plaid',
      providerConnectionId: 'item-1',
    });
    await repository.updateCursor({ id: connection.id, cursor: 'cursor-abc' });

    await repository.resetCursor({ id: connection.id });

    const reloaded = await ProviderConnection.findByPk(connection.id);
    expect(reloaded?.syncCursor).toBeNull();
  });
});
