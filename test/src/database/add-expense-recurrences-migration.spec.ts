import { createRequire } from 'module';
import { Sequelize } from 'sequelize';

const url = process.env.CURRENCY_MIGRATION_TEST_URL;
const migration = createRequire(import.meta.url)(
  '../../../migrations/20261102000000-add-expense-recurrences.cjs'
);
const dbName = 'expense_recurrences_migration_test';

describe.skipIf(!url)('add-expense-recurrences migration', () => {
  let admin: Sequelize;
  let db: Sequelize;

  type Row = Record<string, string | number | null>;
  const rows = async (sql: string) => (await db.query(sql))[0] as Row[];
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

  beforeEach(async () => {
    await db.query(`
      DROP TABLE IF EXISTS expenses, expense_recurrences CASCADE;
      CREATE TABLE expenses (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        total double precision NOT NULL
      );
      INSERT INTO expenses (total) VALUES (10.5), (20);
    `);
  });

  it('leaves existing expenses outside any series', async () => {
    await up();

    expect(await rows('SELECT COUNT(*)::int AS n FROM expenses WHERE recurrence_id IS NULL AND recurrence_index IS NULL')).toEqual([{ n: 2 }]);
  });

  it('requires recurrence_id and recurrence_index together', async () => {
    await up();

    await expect(db.query('UPDATE expenses SET recurrence_index = 0')).rejects.toThrow(/check constraint/);
  });

  it('rejects an unknown frequency', async () => {
    await up();

    await expect(
      db.query('INSERT INTO expense_recurrences (user_id, frequency) VALUES (gen_random_uuid(), \'Weekly\')')
    ).rejects.toThrow(/check constraint/);
  });

  it('refuses to delete a series that still has expenses', async () => {
    await up();
    const [{ id }] = await rows('INSERT INTO expense_recurrences (user_id, frequency) VALUES (gen_random_uuid(), \'Monthly\') RETURNING id');
    await db.query(`UPDATE expenses SET recurrence_id = '${id}', recurrence_index = 0 WHERE total = 20`);

    await expect(db.query(`DELETE FROM expense_recurrences WHERE id = '${id}'`)).rejects.toThrow(/foreign key constraint/);
  });

  it('rolls back cleanly', async () => {
    await up();
    await down();

    expect(await rows('SELECT to_regclass(\'expense_recurrences\') AS t')).toEqual([{ t: null }]);
  });
});
