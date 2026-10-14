import { createRequire } from 'module';
import { Sequelize } from 'sequelize';

// Needs a Postgres server; set CURRENCY_MIGRATION_TEST_URL=postgres://user:pw@host:port/postgres
const url = process.env.CURRENCY_MIGRATION_TEST_URL;
const migration = createRequire(import.meta.url)(
  '../../../migrations/20261014000000-add-foreign-amount.cjs'
);
const dbName = 'foreign_amount_migration_test';

describe.skipIf(!url)('add-foreign-amount migration', () => {
  let admin: Sequelize;
  let db: Sequelize;

  type Row = Record<string, string | number | null>;
  const rows = async (sql: string) => (await db.query(sql))[0] as Row[];
  const up = () => migration.up(db.getQueryInterface(), Sequelize);
  const down = () => migration.down(db.getQueryInterface(), Sequelize);
  const fingerprint = () =>
    rows(
      `SELECT COUNT(*)::int AS n, SUM(total)::text AS total,
              md5(string_agg(id::text || ':' || total::text || ':' || pay_before::text || ':' || currency, ',' ORDER BY id)) AS checksum
       FROM expenses`
    );

  type Columns = Record<string, string>;
  const insert = (columns: Columns) =>
    db.query(
      `INSERT INTO expenses (total, pay_before, currency, ${Object.keys(columns).join(', ')})
       VALUES (10, now(), 'MXN', ${Object.values(columns).join(', ')})`
    );
  const foreign: Columns = {
    original_total: '5',
    original_currency: '\'USD\'',
    exchange_rate: '0.05',
    rate_date: '\'2026-01-01\'',
    rate_source: '\'BANXICO_FIX\'',
    fixed_rate: 'false',
  };
  const without = (...names: string[]) =>
    Object.fromEntries(Object.entries(foreign).filter(([name]) => !names.includes(name)));

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

  beforeEach(async () => {
    await db.query(`
      DROP TABLE IF EXISTS expenses CASCADE;
      CREATE TABLE expenses (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        total double precision NOT NULL,
        pay_before timestamptz NOT NULL,
        currency char(3) NOT NULL DEFAULT 'USD'
      );
      INSERT INTO expenses (total, pay_before, currency) VALUES
        (10.10, '2025-03-31 23:59:59+00', 'MXN'),
        (30.30, '2026-01-01 00:00:00+00', 'USD');
    `);
  });

  it('leaves existing rows untouched and domestic', async () => {
    const before = await fingerprint();

    await up();

    expect(await fingerprint()).toEqual(before);
    expect(
      await rows(
        'SELECT COUNT(*)::int AS n FROM expenses WHERE original_total IS NULL AND original_currency IS NULL AND exchange_rate IS NULL AND rate_date IS NULL AND rate_source IS NULL AND fixed_rate = false'
      )
    ).toEqual([{ n: 2 }]);
  });

  it('accepts a consistent foreign row', async () => {
    await up();

    await insert(foreign);

    expect(await rows('SELECT original_total::text AS t, exchange_rate::text AS r FROM expenses WHERE original_total IS NOT NULL')).toEqual([
      { t: '5.00', r: '0.0500000000' },
    ]);
  });

  it.each<[string, Columns]>([
    ['original total without currency', without('original_currency')],
    ['original currency without total', without('original_total')],
    ['original currency equal to currency', { ...foreign, original_currency: '\'MXN\'' }],
    ['malformed original currency', { ...foreign, original_currency: '\'us1\'' }],
    ['non-positive original total', { ...foreign, original_total: '0' }],
    ['rate fields without an original', { exchange_rate: '1' }],
    ['fixed_rate without an original', { fixed_rate: 'true' }],
    ['non-positive rate', { ...foreign, exchange_rate: '0' }],
    ['original without a rate', without('exchange_rate')],
    ['original without a rate date', without('rate_date')],
    ['original without a rate source', without('rate_source')],
  ])('rejects %s', async (_name, columns) => {
    await up();

    await expect(insert(columns)).rejects.toThrow(/check constraint/);
  });

  it('aborts and rolls back when the migration would change existing data', async () => {
    const queryInterface = db.getQueryInterface();
    const original = queryInterface.addColumn.bind(queryInterface);
    vi.spyOn(queryInterface, 'addColumn').mockImplementation(async (table, column, definition, options) => {
      await original(table, column, definition, options);
      await db.query('UPDATE expenses SET total = total + 1', { transaction: options.transaction });
    });

    await expect(up()).rejects.toThrow(/changed expenses_total/);

    vi.restoreAllMocks();
    expect(
      await rows('SELECT column_name FROM information_schema.columns WHERE table_name = \'expenses\' AND column_name = \'original_total\'')
    ).toEqual([]);
  });

  it('down removes only the new columns, up again works', async () => {
    const before = await fingerprint();
    await up();
    await down();

    expect(
      await rows(
        'SELECT column_name FROM information_schema.columns WHERE table_name = \'expenses\' ORDER BY column_name'
      )
    ).toEqual([{ column_name: 'currency' }, { column_name: 'id' }, { column_name: 'pay_before' }, { column_name: 'total' }]);
    expect(await fingerprint()).toEqual(before);

    await up();
    expect(await fingerprint()).toEqual(before);
  });
});
