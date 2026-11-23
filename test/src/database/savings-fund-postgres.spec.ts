import { Sequelize } from 'sequelize';
import { initModels } from '../../../src/models/init-models.js';
import { SavingsFund } from '../../../src/models/index.js';
import { CurrencyCode } from '../../../src/generated/graphql.js';
import { SavingsFundRepository } from '../../../src/repository/savings-fund-repository.js';

const url = process.env.CURRENCY_MIGRATION_TEST_URL;
const dbName = 'savings_fund_test';
const userId = '11111111-1111-4111-8111-111111111111';

describe.skipIf(!url)('savings fund on Postgres', () => {
  let admin: Sequelize;
  let db: Sequelize;

  beforeAll(async () => {
    admin = new Sequelize(url!, { logging: false });
    await admin.query(`DROP DATABASE IF EXISTS ${dbName}`);
    await admin.query(`CREATE DATABASE ${dbName}`);
    db = new Sequelize(url!.replace(/\/[^/]*$/, `/${dbName}`), { logging: false });
    initModels(db);
    await SavingsFund.sync();
  });

  afterAll(async () => {
    await db?.close();
    await admin?.query(`DROP DATABASE IF EXISTS ${dbName}`);
    await admin?.close();
  });

  it('creates a single first fund under concurrent requests', async () => {
    const repo = new SavingsFundRepository(userId, db);
    const currency = () =>
      new Promise<CurrencyCode>((resolve) => setTimeout(() => resolve(CurrencyCode.MXN), 50));

    const funds = await Promise.all(
      Array.from({ length: 5 }, () => repo.getOrCreateFirstFund('Ahorros', currency))
    );

    expect(new Set(funds.map((fund) => fund.id)).size).toBe(1);
    expect(await SavingsFund.count({ where: { userId } })).toBe(1);
    expect(funds[0]).toMatchObject({ name: 'Ahorros', currency: CurrencyCode.MXN });
  });
});
