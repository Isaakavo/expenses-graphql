import { Sequelize } from 'sequelize';
import { associateModels } from '../../../src/models/associations.js';
import { initModels } from '../../../src/models/init-models.js';
import { Category, Expense, Goal, SubCategory } from '../../../src/models/index.js';
import { CurrencyCode } from '../../../src/generated/graphql.js';
import { ExchangeRateRepository } from '../../../src/repository/exchange-rate-repository.js';
import { ExchangeRateService } from '../../../src/service/exchange-rate-service.js';
import { GoalService } from '../../../src/service/goal-service.js';
import { UserSettingsRepository } from '../../../src/repository/user-settings-repository.js';

// Needs a Postgres server; set CURRENCY_MIGRATION_TEST_URL=postgres://user:pw@host:port/postgres
const url = process.env.CURRENCY_MIGRATION_TEST_URL;
const dbName = 'goal_currency_test';
const userId = '11111111-1111-4111-8111-111111111111';
const otherUserId = '22222222-2222-4222-8222-222222222222';
const NOW = new Date('2026-10-13T18:00:00Z');
const { MXN, USD } = CurrencyCode;

describe.skipIf(!url)('goal currency on Postgres', () => {
  let admin: Sequelize;
  let db: Sequelize;
  let service: GoalService;
  let subCategoryId: string;

  const day = (date: string) => new Date(`${date}T00:00:00Z`);
  const newGoal = (currency?: CurrencyCode) =>
    service.createGoal({ name: 'Trip', targetAmount: 1000, startDate: '2026-01-01', currency });
  const link = (goalId: string, values: { total: number; currency: CurrencyCode; payBefore: string; [column: string]: unknown }) =>
    Expense.create({
      userId,
      concept: 'Hotel',
      periodId: '00000000-0000-4000-8000-000000000001',
      subCategoryId,
      goalId,
      goalRole: 'SPENDING',
      ...values,
      payBefore: day(values.payBefore),
    });

  beforeAll(async () => {
    admin = new Sequelize(url!, { logging: false });
    await admin.query(`DROP DATABASE IF EXISTS ${dbName}`);
    await admin.query(`CREATE DATABASE ${dbName}`);
    db = new Sequelize(url!.replace(/\/[^/]*$/, `/${dbName}`), { logging: false });
    initModels(db);
    associateModels();
  });

  afterAll(async () => {
    await db?.close();
    await admin?.query(`DROP DATABASE IF EXISTS ${dbName}`);
    await admin?.close();
  });

  beforeEach(async () => {
    await db.sync({ force: true });
    await db.query('ALTER TABLE expenses DROP CONSTRAINT IF EXISTS expenses_period_id_fkey');
    const category = await Category.create({ name: 'Home', userId: null });
    subCategoryId = (await SubCategory.create({ name: 'Rent', userId: null, categoryId: category.id })).id;
    const rates = new ExchangeRateRepository();
    await rates.upsertMany(
      [['2026-10-01', 18], ['2026-10-02', 20]].map(([rateDate, rate]) => ({
        base: USD,
        quote: MXN,
        rateDate: rateDate as string,
        rate: rate as number,
        source: 'BANXICO_FIX',
      }))
    );
    service = new GoalService(userId, db);
    Object.assign(service, {
      exchangeRates: new ExchangeRateService({
        repository: rates,
        fetchRates: async () => [],
        now: () => NOW,
      }),
    });
  });

  it('creates goals in the user default currency unless one is given', async () => {
    expect((await newGoal()).currency).toBe(USD);

    await new UserSettingsRepository(userId, db).setDefaultCurrency(MXN);

    expect((await newGoal()).currency).toBe(MXN);
    expect((await newGoal(USD)).currency).toBe(USD);
  });

  it('computes goal amounts for the three branches, batched, scoped to the user', async () => {
    const goal = await newGoal(USD);
    const same = await link(goal.id, { total: 100, currency: USD, payBefore: '2026-10-01' });
    const original = await link(goal.id, {
      total: 1900, currency: MXN, payBefore: '2026-10-01',
      originalTotal: '105.25', originalCurrency: USD, exchangeRate: 18.05, rateDate: '2026-10-01',
      rateSource: 'BANXICO_FIX', fixedRate: false,
    });
    const converted = await link(goal.id, { total: 1000, currency: MXN, payBefore: '2026-10-02' });
    const foreign = await link(goal.id, { total: 5, currency: USD, payBefore: '2026-10-02', userId: otherUserId });
    const unlinked = await Expense.create({
      userId, concept: 'x', total: 1, currency: USD, payBefore: day('2026-10-01'),
      periodId: '00000000-0000-4000-8000-000000000001', subCategoryId,
    });

    const amounts = await service.getGoalAmountsByExpenseIds(
      [same, original, converted, foreign, unlinked].map((e) => String(e.id))
    );

    expect(amounts).toEqual(['$100.00', '$105.25', '$50.00', null, null]);
  });

  it('changing the goal currency re-derives the amounts of its linked expenses', async () => {
    const goal = await newGoal(USD);
    const expense = await link(goal.id, { total: 1000, currency: MXN, payBefore: '2026-10-01' });

    expect(await service.getGoalAmountsByExpenseIds([String(expense.id)])).toEqual(['$55.56']);

    await service.updateGoal({ id: goal.id, name: 'Trip', targetAmount: 1000, startDate: '2026-01-01', currency: MXN });

    expect((await Goal.findByPk(goal.id))!.currency).toBe(MXN);
    expect(await service.getGoalAmountsByExpenseIds([String(expense.id)])).toEqual(['$1,000.00']);
  });
});
