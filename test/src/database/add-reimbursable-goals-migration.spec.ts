import { createRequire } from 'module';
import { Sequelize } from 'sequelize';

const url = process.env.CURRENCY_MIGRATION_TEST_URL;
const migration = createRequire(import.meta.url)(
  '../../../migrations/20261121000000-add-reimbursable-goals.cjs'
);
const dbName = 'reimbursable_goals_migration_test';
const userId = '11111111-1111-4111-8111-111111111111';

describe.skipIf(!url)('add-reimbursable-goals migration', () => {
  let admin: Sequelize;
  let db: Sequelize;

  type Row = Record<string, string | number | null>;
  const rows = async (sql: string) => (await db.query(sql))[0] as Row[];
  const up = () => migration.up(db.getQueryInterface(), Sequelize);
  const down = () => migration.down(db.getQueryInterface(), Sequelize);
  const insertFund = async () =>
    (
      await rows(
        `INSERT INTO savings_funds (user_id, name, currency) VALUES ('${userId}', 'Ahorros', 'MXN') RETURNING id`
      )
    )[0].id;

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
      DROP TABLE IF EXISTS goal_reimbursements, goals, savings_funds, "Cards" CASCADE;
      CREATE TABLE "Cards" (id uuid PRIMARY KEY DEFAULT gen_random_uuid());
      CREATE TABLE goals (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        name varchar(100) NOT NULL,
        target_amount numeric(12,2) NOT NULL,
        start_date date NOT NULL
      );
      INSERT INTO goals (name, target_amount, start_date) VALUES ('Trip', 1000, '2026-01-01');
    `);
  });

  it('keeps existing goals as savings goals', async () => {
    await up();

    expect(await rows('SELECT kind, fund_id, default_card_id, target_amount FROM goals')).toEqual([
      { kind: 'SAVINGS', fund_id: null, default_card_id: null, target_amount: '1000.00' },
    ]);
  });

  it('requires a fund and no target on reimbursable goals', async () => {
    await up();
    const fundId = await insertFund();

    await expect(
      db.query('INSERT INTO goals (name, kind, start_date) VALUES (\'E\', \'REIMBURSABLE\', \'2026-11-25\')')
    ).rejects.toThrow(/check constraint/);
    await expect(
      db.query(`INSERT INTO goals (name, kind, target_amount, start_date, fund_id) VALUES ('E', 'REIMBURSABLE', 5, '2026-11-25', '${fundId}')`)
    ).rejects.toThrow(/check constraint/);
    await expect(
      db.query('INSERT INTO goals (name, start_date) VALUES (\'S\', \'2026-11-25\')')
    ).rejects.toThrow(/check constraint/);
    await db.query(`INSERT INTO goals (name, kind, start_date, fund_id) VALUES ('E', 'REIMBURSABLE', '2026-11-25', '${fundId}')`);
  });

  it('rejects an unknown kind and a non-positive reimbursement', async () => {
    await up();

    await expect(db.query('UPDATE goals SET kind = \'OTHER\'')).rejects.toThrow(/check constraint/);
    const [{ id }] = await rows('SELECT id FROM goals');
    await expect(
      db.query(`INSERT INTO goal_reimbursements (user_id, goal_id, amount, received_on) VALUES ('${userId}', '${id}', 0, '2026-12-01')`)
    ).rejects.toThrow(/check constraint/);
  });

  it('deletes reimbursements with their goal and clears a deleted default card', async () => {
    await up();
    const fundId = await insertFund();
    const [{ id: cardId }] = await rows('INSERT INTO "Cards" DEFAULT VALUES RETURNING id');
    const [{ id: goalId }] = await rows(
      `INSERT INTO goals (name, kind, start_date, fund_id, default_card_id) VALUES ('E', 'REIMBURSABLE', '2026-11-25', '${fundId}', '${cardId}') RETURNING id`
    );
    await db.query(
      `INSERT INTO goal_reimbursements (user_id, goal_id, amount, received_on) VALUES ('${userId}', '${goalId}', 600, '2026-12-01')`
    );

    await db.query(`DELETE FROM "Cards" WHERE id = '${cardId}'`);
    expect(await rows(`SELECT default_card_id FROM goals WHERE id = '${goalId}'`)).toEqual([
      { default_card_id: null },
    ]);
    await db.query(`DELETE FROM goals WHERE id = '${goalId}'`);
    expect(await rows('SELECT COUNT(*)::int AS n FROM goal_reimbursements')).toEqual([{ n: 0 }]);
  });

  it('reverts cleanly without events and refuses to drop events', async () => {
    await up();
    await down();
    expect(await rows('SELECT to_regclass(\'savings_funds\') AS t')).toEqual([{ t: null }]);
    expect(
      await rows('SELECT is_nullable FROM information_schema.columns WHERE table_name = \'goals\' AND column_name = \'target_amount\'')
    ).toEqual([{ is_nullable: 'NO' }]);

    await up();
    const fundId = await insertFund();
    await db.query(`INSERT INTO goals (name, kind, start_date, fund_id) VALUES ('E', 'REIMBURSABLE', '2026-11-25', '${fundId}')`);
    await expect(down()).rejects.toThrow(/reimbursable goal/);
  });
});
