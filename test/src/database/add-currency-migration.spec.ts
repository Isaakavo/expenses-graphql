import { createRequire } from 'module';
import { Sequelize } from 'sequelize';

// Needs a Postgres server; set CURRENCY_MIGRATION_TEST_URL=postgres://user:pw@host:port/postgres
const url = process.env.CURRENCY_MIGRATION_TEST_URL;
const migration = createRequire(import.meta.url)(
  '../../../migrations/20261012000000-add-currency.cjs'
);
const dbName = 'currency_migration_test';

const periodUsd = '00000000-0000-4000-8000-000000000001';
const periodMxn = '00000000-0000-4000-8000-000000000002';
const userId = '11111111-1111-4111-8111-111111111111';

describe.skipIf(!url)('add-currency migration', () => {
  let admin: Sequelize;
  let db: Sequelize;

  type Row = Record<string, string | number | null>;
  const rows = async (sql: string) => (await db.query(sql))[0] as Row[];

  const resetSchema = async () => {
    await db.query(`
      DROP TABLE IF EXISTS user_settings, expenses, incomes, "Cards", periods CASCADE;
      CREATE TABLE periods (id uuid PRIMARY KEY);
      CREATE TABLE "Cards" (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), bank varchar(255) NOT NULL, alias varchar(255));
      CREATE TABLE expenses (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        total double precision NOT NULL,
        pay_before timestamptz NOT NULL,
        period_id uuid NOT NULL REFERENCES periods(id)
      );
      CREATE TABLE incomes (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        total double precision NOT NULL,
        payment_date timestamptz NOT NULL,
        period_id uuid NOT NULL REFERENCES periods(id)
      );
      INSERT INTO periods VALUES ('${periodMxn}'), ('${periodUsd}');
      INSERT INTO expenses (total, pay_before, period_id) VALUES
        (10.10, '2025-03-31 23:59:59+00', '${periodMxn}'),
        (20.20, '2025-03-15 00:00:00+00', '${periodMxn}'),
        (30.30, '2025-04-01 00:00:00+00', '${periodUsd}'),
        (40.40, '2026-01-01 00:00:00+00', '${periodUsd}');
      INSERT INTO incomes (total, payment_date, period_id) VALUES
        (500, '2025-03-15 00:00:00+00', '${periodMxn}'),
        (600, '2025-04-04 00:00:00+00', '${periodUsd}');
      INSERT INTO "Cards" (bank) VALUES
        ('Banregio'), ('BBVA'), ('Hey Banco'), ('Liverpool'), ('Santander'),
        ('Bank of America '), ('Wells Fargo'), ('Chase'), ('Unknown Bank');
    `);
  };

  const up = () => migration.up(db.getQueryInterface(), Sequelize);
  const down = () => migration.down(db.getQueryInterface(), Sequelize);

  beforeAll(async () => {
    admin = new Sequelize(url!, { logging: false });
    await admin.query(`DROP DATABASE IF EXISTS ${dbName}`);
    await admin.query(`CREATE DATABASE ${dbName}`);
    db = new Sequelize(url!.replace(/\/[^/]*$/, `/${dbName}`), { logging: false });
  });

  afterAll(async () => {
    await db?.close();
    await admin?.query(`DROP DATABASE IF EXISTS ${dbName}`);
    await admin?.close();
  });

  beforeEach(resetSchema);

  it('backfills currencies at the 2025-04-01 boundary without touching totals', async () => {
    await up();

    expect(
      await rows('SELECT currency, COUNT(*)::int AS n, SUM(total)::numeric(12,2)::text AS total FROM expenses GROUP BY 1 ORDER BY 1')
    ).toEqual([
      { currency: 'MXN', n: 2, total: '30.30' },
      { currency: 'USD', n: 2, total: '70.70' },
    ]);
    expect(await rows('SELECT currency FROM incomes ORDER BY payment_date')).toEqual([
      { currency: 'MXN' },
      { currency: 'USD' },
    ]);
  });

  it('backfills card currencies by bank and leaves unmatched cards NULL', async () => {
    await up();

    const cards = await rows('SELECT bank, currency FROM "Cards"');
    const byBank = Object.fromEntries(cards.map((c) => [c.bank, c.currency]));
    expect(byBank).toEqual({
      Banregio: 'MXN',
      BBVA: 'MXN',
      'Hey Banco': 'MXN',
      Liverpool: 'MXN',
      Santander: 'MXN',
      'Bank of America ': 'USD',
      'Wells Fargo': 'USD',
      Chase: 'USD',
      'Unknown Bank': null,
    });
  });

  it('logs the cards left without currency and does not abort', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);

    await up();

    expect(warn).toHaveBeenCalledTimes(1);
    expect(warn.mock.calls[0][0]).toContain('Unknown Bank');
    warn.mockRestore();
  });

  it('creates user_settings and rejects invalid codes', async () => {
    await up();

    await db.query(`INSERT INTO user_settings (user_id) VALUES ('${userId}')`);
    expect(await rows('SELECT default_currency FROM user_settings')).toEqual([
      { default_currency: 'USD' },
    ]);
    await expect(
      db.query('UPDATE user_settings SET default_currency = \'usd\'')
    ).rejects.toThrow();
    await expect(
      db.query('UPDATE expenses SET currency = \'US1\'')
    ).rejects.toThrow();
    await expect(
      db.query('UPDATE "Cards" SET currency = \'EURO\'')
    ).rejects.toThrow();
  });

  it('aborts and rolls back when a period mixes currencies', async () => {
    await db.query(
      `UPDATE incomes SET payment_date = '2024-01-01 00:00:00+00' WHERE period_id = '${periodUsd}'`
    );

    await expect(up()).rejects.toThrow(/mixing currencies/);

    expect(
      await rows('SELECT column_name FROM information_schema.columns WHERE table_name = \'expenses\' AND column_name = \'currency\'')
    ).toEqual([]);
    expect(await rows('SELECT to_regclass(\'user_settings\') AS t')).toEqual([{ t: null }]);
  });

  it('down removes only the new columns and table, up again works', async () => {
    await up();
    await down();

    expect(
      await rows('SELECT table_name FROM information_schema.columns WHERE column_name = \'currency\' AND table_name IN (\'expenses\',\'incomes\',\'Cards\')')
    ).toEqual([]);
    expect(await rows('SELECT to_regclass(\'user_settings\') AS t')).toEqual([{ t: null }]);
    expect(await rows('SELECT COUNT(*)::int AS n FROM expenses')).toEqual([{ n: 4 }]);

    await up();
    expect(await rows('SELECT COUNT(*)::int AS n FROM expenses WHERE currency = \'MXN\'')).toEqual([{ n: 2 }]);
  });
});
