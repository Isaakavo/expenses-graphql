import { describe, it, expect, vi, afterEach } from 'vitest';
import { Sequelize } from 'sequelize';

// The model init/associate helpers touch shared model classes; stub them out so
// each test can exercise the syncTables control flow in isolation.
vi.mock('../../../src/models/init-models.js', () => ({
  initModels: vi.fn(),
}));
vi.mock('../../../src/models/associations.js', () => ({
  associateModels: vi.fn(),
}));
vi.mock('../../../src/logger.js', () => ({
  logger: { info: vi.fn(), error: vi.fn() },
}));

import { syncTables } from '../../../src/database/sync-database.js';

const originalEnv = process.env.NODE_ENV;

const makeSequelize = () => new Sequelize('sqlite::memory:', { logging: false });

afterEach(() => {
  process.env.NODE_ENV = originalEnv;
  vi.restoreAllMocks();
});

describe('syncTables', () => {
  it('rethrows when the database connection fails (ITEM A)', async () => {
    const sequelize = makeSequelize();
    vi.spyOn(sequelize, 'authenticate').mockRejectedValue(
      new Error('connection refused')
    );

    await expect(syncTables(sequelize)).rejects.toThrow('connection refused');
  });

  it('does not run sequelize.sync() in production (ITEM B)', async () => {
    process.env.NODE_ENV = 'production';
    const sequelize = makeSequelize();
    vi.spyOn(sequelize, 'authenticate').mockResolvedValue(undefined);
    const syncSpy = vi.spyOn(sequelize, 'sync').mockResolvedValue(sequelize);

    await syncTables(sequelize);

    expect(syncSpy).not.toHaveBeenCalled();
  });

  it('runs sequelize.sync() outside production (ITEM B)', async () => {
    process.env.NODE_ENV = 'test';
    const sequelize = makeSequelize();
    vi.spyOn(sequelize, 'authenticate').mockResolvedValue(undefined);
    const syncSpy = vi.spyOn(sequelize, 'sync').mockResolvedValue(sequelize);

    await syncTables(sequelize);

    expect(syncSpy).toHaveBeenCalled();
  });
});
