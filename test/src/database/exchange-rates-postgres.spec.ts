import { Sequelize } from 'sequelize';
import { initModels } from '../../../src/models/init-models.js';
import { ExchangeRateRepository } from '../../../src/repository/exchange-rate-repository.js';

// Needs a Postgres server; set CURRENCY_MIGRATION_TEST_URL=postgres://user:pw@host:port/postgres
const url = process.env.CURRENCY_MIGRATION_TEST_URL;
const dbName = 'exchange_rates_test';

const row = (rateDate: string, rate: number, source = 'BANXICO_FIX') => ({
  base: 'USD',
  quote: 'MXN',
  rateDate,
  rate,
  source,
});

describe.skipIf(!url)('exchange rate upsert on Postgres', () => {
  let admin: Sequelize;
  let db: Sequelize;
  const repository = new ExchangeRateRepository();

  beforeAll(async () => {
    admin = new Sequelize(url!, { logging: false });
    await admin.query(`DROP DATABASE IF EXISTS ${dbName}`);
    await admin.query(`CREATE DATABASE ${dbName}`);
    db = new Sequelize(url!.replace(/\/[^/]*$/, `/${dbName}`), { logging: false });
    initModels(db);
  });

  afterAll(async () => {
    await db?.close();
    await admin?.query(`DROP DATABASE IF EXISTS ${dbName}`);
    await admin?.close();
  });

  beforeEach(() => db.sync({ force: true }));

  it('is idempotent on the (base, quote, rate_date) key and updates changed rates', async () => {
    await repository.upsertMany([row('2026-10-09', 18.4), row('2026-10-12', 18.5)]);
    await repository.upsertMany([row('2026-10-12', 18.6), row('2026-10-13', 18.7)]);

    const rates = await repository.findBetween('USD', 'MXN', '2026-10-09', '2026-10-13');

    expect(rates.map((r) => [r.rateDate, r.rate])).toEqual([
      ['2026-10-09', 18.4],
      ['2026-10-12', 18.6],
      ['2026-10-13', 18.7],
    ]);
  });

  it('returns the latest rate on or before a date', async () => {
    await repository.upsertMany([row('2026-10-09', 18.4), row('2026-10-13', 18.7)]);

    expect((await repository.findLatestOnOrBefore('USD', 'MXN', '2026-10-11')).rateDate).toBe(
      '2026-10-09'
    );
  });
});
