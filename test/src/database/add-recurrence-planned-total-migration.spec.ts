import { createRequire } from 'module';
import { Sequelize } from 'sequelize';

const url = process.env.CURRENCY_MIGRATION_TEST_URL;
const migration = createRequire(import.meta.url)(
  '../../../migrations/20261123000000-add-recurrence-planned-total.cjs'
);
const dbName = 'recurrence_planned_total_migration_test';

describe.skipIf(!url)('add-recurrence-planned-total migration', () => {
  let admin: Sequelize;
  let db: Sequelize;

  const rows = async (sql: string) => (await db.query(sql))[0] as Record<string, unknown>[];
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
      DROP TABLE IF EXISTS expense_recurrences;
      CREATE TABLE expense_recurrences (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), frequency varchar(10) NOT NULL);
      INSERT INTO expense_recurrences (frequency) VALUES ('Monthly');
    `);
  });

  it('keeps existing series per occurrence and only accepts a positive total', async () => {
    await up();

    expect(await rows('SELECT planned_total FROM expense_recurrences')).toEqual([{ planned_total: null }]);
    await db.query('INSERT INTO expense_recurrences (frequency, planned_total) VALUES (\'Biweekly\', 610)');
    await expect(
      db.query('INSERT INTO expense_recurrences (frequency, planned_total) VALUES (\'Biweekly\', 0)')
    ).rejects.toThrow(/check constraint/);
  });

  it('reverts cleanly', async () => {
    await up();
    await down();

    expect(
      await rows('SELECT column_name FROM information_schema.columns WHERE table_name = \'expense_recurrences\'')
    ).toEqual([{ column_name: 'id' }, { column_name: 'frequency' }]);
  });
});
