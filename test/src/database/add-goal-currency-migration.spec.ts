import { createRequire } from 'module';
import { Sequelize } from 'sequelize';

// Needs a Postgres server; set CURRENCY_MIGRATION_TEST_URL=postgres://user:pw@host:port/postgres
const url = process.env.CURRENCY_MIGRATION_TEST_URL;
const migration = createRequire(import.meta.url)(
  '../../../migrations/20261015000000-add-goal-currency.cjs'
);
const dbName = 'goal_currency_migration_test';

describe.skipIf(!url)('add-goal-currency migration', () => {
  let admin: Sequelize;
  let db: Sequelize;

  type Row = Record<string, string | number | null>;
  const rows = async (sql: string) => (await db.query(sql))[0] as Row[];
  const up = () => migration.up(db.getQueryInterface(), Sequelize);
  const down = () => migration.down(db.getQueryInterface(), Sequelize);
  const goalColumns = () =>
    rows(
      'SELECT column_name FROM information_schema.columns WHERE table_name = \'goals\' ORDER BY column_name'
    );

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
      DROP TABLE IF EXISTS expenses, goals CASCADE;
      CREATE TABLE goals (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        name varchar(100) NOT NULL,
        target_amount numeric(12,2) NOT NULL,
        start_date date NOT NULL,
        end_date date
      );
      CREATE TABLE expenses (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        total double precision NOT NULL,
        goal_id uuid REFERENCES goals(id)
      );
      INSERT INTO goals (name, target_amount, start_date, end_date) VALUES
        ('Trip', 1000, '2026-01-01', NULL),
        ('Car', 5000.50, '2026-02-01', '2026-12-31');
      INSERT INTO expenses (total, goal_id) SELECT 10.5, id FROM goals;
    `);
  });

  it('makes every existing goal USD and leaves the data untouched', async () => {
    const fingerprint = () =>
      rows(
        'SELECT COUNT(*)::int AS n, md5(string_agg(id::text || name || target_amount::text || start_date::text, \',\' ORDER BY id)) AS checksum FROM goals'
      );
    const before = await fingerprint();

    await up();

    expect(await fingerprint()).toEqual(before);
    expect(await rows('SELECT currency FROM goals')).toEqual([{ currency: 'USD' }, { currency: 'USD' }]);
    expect(await rows('SELECT COUNT(*)::int AS n FROM expenses WHERE goal_id IS NOT NULL')).toEqual([{ n: 2 }]);
  });

  it.each(['us', 'usd', 'US1', ''])('rejects the malformed currency %j', async (currency) => {
    await up();

    await expect(
      db.query(`INSERT INTO goals (name, target_amount, start_date, currency) VALUES ('x', 1, '2026-01-01', '${currency}')`)
    ).rejects.toThrow(/check constraint|too long/);
  });

  it('rolls back when the migration would change existing data', async () => {
    const queryInterface = db.getQueryInterface();
    const original = queryInterface.addColumn.bind(queryInterface);
    vi.spyOn(queryInterface, 'addColumn').mockImplementation(async (table, column, definition, options) => {
      await original(table, column, definition, options);
      await db.query('UPDATE goals SET target_amount = target_amount + 1', { transaction: options.transaction });
    });

    await expect(up()).rejects.toThrow(/changed goals_checksum/);

    vi.restoreAllMocks();
    expect(await goalColumns()).not.toContainEqual({ column_name: 'currency' });
  });

  it('down removes only the new column, up again works', async () => {
    await up();
    await down();

    expect(await goalColumns()).toEqual([
      { column_name: 'end_date' },
      { column_name: 'id' },
      { column_name: 'name' },
      { column_name: 'start_date' },
      { column_name: 'target_amount' },
    ]);

    await up();
    expect(await rows('SELECT currency FROM goals')).toEqual([{ currency: 'USD' }, { currency: 'USD' }]);
  });
});
