import { createRequire } from 'module';
import { Sequelize } from 'sequelize';

const url = process.env.CURRENCY_MIGRATION_TEST_URL;
const migration = createRequire(import.meta.url)(
  '../../../migrations/20261112000000-add-stadium-category.cjs'
);
const dbName = 'stadium_category_migration_test';
const fullUser = '11111111-1111-4111-8111-111111111111';
const roomyUser = '22222222-2222-4222-8222-222222222222';

describe.skipIf(!url)('add-stadium-category migration', () => {
  let admin: Sequelize;
  let db: Sequelize;

  type Row = Record<string, string | number | null>;
  const rows = async (sql: string) => (await db.query(sql))[0] as Row[];
  const up = () => migration.up(db.getQueryInterface(), Sequelize);
  const down = () => migration.down(db.getQueryInterface(), Sequelize);

  const expensesBySubCategory = () =>
    rows(`
      SELECT c.name AS category, s.name AS sub_category, COUNT(e.id)::int AS n
      FROM sub_categories s
      JOIN categories c ON c.id = s.category_id
      LEFT JOIN expenses e ON e.sub_category_id = s.id
      GROUP BY 1, 2 ORDER BY 1, 2
    `);
  const settings = () =>
    rows(`
      SELECT cs.user_id, c.name, cs.percentage::float AS percentage
      FROM category_settings cs JOIN categories c ON c.id = cs.category_id
      ORDER BY 1, 2
    `);

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
      DROP TABLE IF EXISTS income_category_allocation, category_settings, expenses, sub_categories, categories CASCADE;
      CREATE TABLE categories (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id uuid,
        name varchar UNIQUE NOT NULL,
        created_at timestamptz NOT NULL DEFAULT NOW(),
        updated_at timestamptz
      );
      CREATE TABLE sub_categories (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id uuid,
        name varchar UNIQUE NOT NULL,
        category_id uuid NOT NULL REFERENCES categories (id),
        created_at timestamptz NOT NULL DEFAULT NOW(),
        updated_at timestamptz
      );
      CREATE TABLE expenses (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        concept varchar NOT NULL,
        sub_category_id uuid NOT NULL REFERENCES sub_categories (id)
      );
      CREATE TABLE category_settings (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id uuid NOT NULL,
        category_id uuid NOT NULL REFERENCES categories (id),
        percentage decimal(5, 2) NOT NULL,
        created_at timestamptz NOT NULL DEFAULT NOW(),
        updated_at timestamptz,
        UNIQUE (user_id, category_id)
      );
      CREATE TABLE income_category_allocation (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        category_id uuid NOT NULL REFERENCES categories (id)
      );

      INSERT INTO categories (name) VALUES ('LIFESTYLE'), ('HEALTH_WELLNESS'), ('HOUSEHOLD');
      INSERT INTO sub_categories (name, category_id)
        SELECT s.name, c.id FROM (VALUES
          ('STADIUM', 'LIFESTYLE'), ('CLOTHES', 'LIFESTYLE'), ('ENTERTAINMENT', 'LIFESTYLE'), ('SPORTS', 'HEALTH_WELLNESS'),
          ('GYM_FITNESS', 'HEALTH_WELLNESS'), ('RENT', 'HOUSEHOLD')
        ) AS s (name, category) JOIN categories c ON c.name = s.category;
      INSERT INTO expenses (concept, sub_category_id)
        SELECT e.concept, s.id FROM (VALUES
          ('Diablos', 'STADIUM'), ('Yankees', 'STADIUM'), ('Shirt', 'CLOTHES'), ('Movie', 'ENTERTAINMENT'),
          ('Padel', 'SPORTS'), ('Gym', 'GYM_FITNESS')
        ) AS e (concept, sub) JOIN sub_categories s ON s.name = e.sub;
      INSERT INTO category_settings (user_id, category_id, percentage)
        SELECT u.user_id::uuid, c.id, u.percentage FROM (VALUES
          ('${fullUser}', 'LIFESTYLE', 0.05), ('${fullUser}', 'HOUSEHOLD', 0.95),
          ('${roomyUser}', 'LIFESTYLE', 0.10), ('${roomyUser}', 'HOUSEHOLD', 0.70)
        ) AS u (user_id, category, percentage) JOIN categories c ON c.name = u.category;
    `);
  });

  const afterUp = [
    { category: 'HEALTH_WELLNESS', sub_category: 'GYM_FITNESS', n: 1 },
    { category: 'HOUSEHOLD', sub_category: 'RENT', n: 0 },
    { category: 'LIFESTYLE', sub_category: 'CLOTHES', n: 1 },
    { category: 'LIFESTYLE', sub_category: 'CONCERTS', n: 0 },
    { category: 'LIFESTYLE', sub_category: 'ENTERTAINMENT', n: 1 },
    { category: 'STADIUM', sub_category: 'BASEBALL', n: 3 },
    { category: 'STADIUM', sub_category: 'HOCKEY', n: 0 },
    { category: 'STADIUM', sub_category: 'NFL', n: 0 },
    { category: 'STADIUM', sub_category: 'SOCCER', n: 0 },
  ];

  it('moves stadium and sports expenses to BASEBALL and adds CONCERTS to LIFESTYLE', async () => {
    await up();

    expect(await expensesBySubCategory()).toEqual(afterUp);
  });

  it('takes the STADIUM share from LIFESTYLE only when the total would pass 100%', async () => {
    await up();

    expect(await settings()).toEqual([
      { user_id: fullUser, name: 'HOUSEHOLD', percentage: 0.95 },
      { user_id: fullUser, name: 'LIFESTYLE', percentage: 0 },
      { user_id: fullUser, name: 'STADIUM', percentage: 0.05 },
      { user_id: roomyUser, name: 'HOUSEHOLD', percentage: 0.7 },
      { user_id: roomyUser, name: 'LIFESTYLE', percentage: 0.1 },
      { user_id: roomyUser, name: 'STADIUM', percentage: 0.05 },
    ]);
  });

  it('can run twice without changing the result', async () => {
    await up();
    const firstSettings = await settings();

    await up();

    expect(await expensesBySubCategory()).toEqual(afterUp);
    expect(await settings()).toEqual(firstSettings);
  });

  it('works when the old stadium sub-category does not exist', async () => {
    await db.query('DELETE FROM expenses WHERE concept IN (\'Diablos\', \'Yankees\'); DELETE FROM sub_categories WHERE name = \'STADIUM\'');

    await up();

    expect(await rows('SELECT COUNT(*)::int AS n FROM sub_categories WHERE name = \'BASEBALL\'')).toEqual([{ n: 1 }]);
  });

  it('rolls back the categories and budget, with every BASEBALL expense back in LIFESTYLE > STADIUM', async () => {
    const beforeSettings = await settings();
    await up();
    await db.query(`
      INSERT INTO income_category_allocation (category_id) SELECT id FROM categories WHERE name = 'STADIUM';
      INSERT INTO expenses (concept, sub_category_id) SELECT 'Concert', id FROM sub_categories WHERE name = 'CONCERTS';
    `);

    await down();

    expect(await expensesBySubCategory()).toEqual([
      { category: 'HEALTH_WELLNESS', sub_category: 'GYM_FITNESS', n: 1 },
      { category: 'HEALTH_WELLNESS', sub_category: 'SPORTS', n: 0 },
      { category: 'HOUSEHOLD', sub_category: 'RENT', n: 0 },
      { category: 'LIFESTYLE', sub_category: 'CLOTHES', n: 1 },
      { category: 'LIFESTYLE', sub_category: 'ENTERTAINMENT', n: 2 },
      { category: 'LIFESTYLE', sub_category: 'STADIUM', n: 3 },
    ]);
    expect(await settings()).toEqual(beforeSettings);
    expect(await rows('SELECT name FROM categories WHERE name = \'STADIUM\'')).toEqual([]);
  });
});
