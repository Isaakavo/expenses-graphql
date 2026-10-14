import { QueryTypes, Sequelize } from 'sequelize';
import { associateModels } from '../../../src/models/associations.js';
import { initModels } from '../../../src/models/init-models.js';
import { Category, Income, SubCategory } from '../../../src/models/index.js';
import { CurrencyCode, FixedExpenseFrequency } from '../../../src/generated/graphql.js';
import { ExpensesService } from '../../../src/service/expenses-service.js';
import { IncomeService } from '../../../src/service/income-service.js';

// Needs a Postgres server; set CURRENCY_MIGRATION_TEST_URL=postgres://user:pw@host:port/postgres
const url = process.env.CURRENCY_MIGRATION_TEST_URL;
const dbName = 'currency_relabel_test';
const userId = '11111111-1111-4111-8111-111111111111';
const { MXN, USD } = CurrencyCode;

// UPDATE ... RETURNING behaves differently on Postgres than on sqlite, so the relabel paths run here
describe.skipIf(!url)('currency relabeling on Postgres', () => {
  let admin: Sequelize;
  let db: Sequelize;
  let incomes: IncomeService;
  let expenses: ExpensesService;
  let subCategoryId: string;

  const rows = <T extends object>(sql: string, replacements = {}) =>
    db.query<T>(sql, { type: QueryTypes.SELECT, replacements });
  const day = (date: string) => new Date(`${date}T00:00:00Z`);
  const periodOf = async (incomeDate: string) =>
    (await Income.findOne({ where: { paymentDate: day(incomeDate) } })).periodId;
  const expenseOn = (periodId: string, date: string) =>
    expenses.createExpense({
      concept: 'e', total: 10, periodId, payBefore: day(date), categoryId: 'unused', subCategoryId,
    });
  const state = (periodId: string) =>
    rows<{ kind: string; currency: string; n: number }>(
      `SELECT 'expense' AS kind, currency, COUNT(*)::int AS n FROM expenses WHERE period_id = :periodId GROUP BY 2
       UNION ALL SELECT 'income', currency, COUNT(*)::int FROM incomes WHERE period_id = :periodId GROUP BY 2
       ORDER BY 1, 2`,
      { periodId }
    );

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
    const category = await Category.create({ name: 'Home', userId: null });
    subCategoryId = (await SubCategory.create({ name: 'Rent', userId: null, categoryId: category.id })).id;
    incomes = new IncomeService(userId, db);
    expenses = new ExpensesService(userId, db);
  });

  const createIncome = (paymentDate: string, currency: CurrencyCode) =>
    incomes.createIncome({ total: 100, currency, paymentDate: paymentDate as unknown as Date });

  it('(a) relabels the incomes and expenses of a period when its income currency changes', async () => {
    await createIncome('2026-03-06', USD);
    const periodId = await periodOf('2026-03-06');
    await expenseOn(periodId, '2026-03-07');
    await expenseOn(periodId, '2026-03-08');
    const { id } = await Income.findOne({ where: { periodId } });

    await incomes.updateIncome({ id, total: 100, currency: MXN, paymentDate: day('2026-03-06') });

    expect(await state(periodId)).toEqual([
      { kind: 'expense', currency: 'MXN', n: 2 },
      { kind: 'income', currency: 'MXN', n: 1 },
    ]);
  });

  it('(b) relabels the destination period when an income moves into it', async () => {
    await createIncome('2026-01-02', MXN);
    await createIncome('2026-03-06', USD);
    const destination = await periodOf('2026-03-06');
    await expenseOn(destination, '2026-03-07');
    const { id } = await Income.findOne({ where: { periodId: await periodOf('2026-01-02') } });

    await incomes.updateIncome({ id, total: 100, paymentDate: day('2026-03-06') });

    expect(await state(destination)).toEqual([
      { kind: 'expense', currency: 'MXN', n: 1 },
      { kind: 'income', currency: 'MXN', n: 2 },
    ]);
  });

  it('(c) retags fallback expenses when the first income of their period arrives', async () => {
    await expenses.createFixedExpenses({
      concept: 'f', total: 10, payBefore: day('2026-07-03'), categoryId: 'unused', subCategoryId,
      numberOfRepetitions: 2, frequency: FixedExpenseFrequency.MONTHLY,
    });

    await createIncome('2026-08-03', MXN);

    expect(
      (await rows<{ currency: string }>('SELECT currency FROM expenses ORDER BY pay_before')).map((r) => r.currency)
    ).toEqual([USD, MXN]);
  });

  it('(d) takes the period currency on create and per repetition of a fixed expense', async () => {
    await createIncome('2026-01-02', MXN);
    await createIncome('2026-03-06', USD);

    expect((await expenseOn(await periodOf('2026-01-02'), '2026-01-03')).currency).toBe(MXN);
    expect((await expenseOn(await periodOf('2026-03-06'), '2026-03-07')).currency).toBe(USD);

    await expenses.createFixedExpenses({
      concept: 'f', total: 10, payBefore: day('2026-01-02'), categoryId: 'unused', subCategoryId,
      numberOfRepetitions: 3, frequency: FixedExpenseFrequency.MONTHLY,
    });
    const fixed = await rows<{ currency: string }>('SELECT currency FROM expenses WHERE concept = \'f\' ORDER BY pay_before');
    // Jan has an MXN income, Feb has none (default USD), Mar has a USD income
    expect(fixed.map((r) => r.currency)).toEqual([MXN, USD, USD]);
  });

  it('(e) leaves no mixed period and untouched rows unchanged', async () => {
    await createIncome('2026-01-02', MXN);
    await createIncome('2026-03-06', USD);
    await createIncome('2026-05-01', USD);
    const untouched = await periodOf('2026-05-01');
    await expenseOn(untouched, '2026-05-02');
    await expenseOn(await periodOf('2026-03-06'), '2026-03-07');
    const checksum = () =>
      rows<{ ck: string }>(
        `SELECT md5(string_agg(id || ':' || total || ':' || pay_before || ':' || currency, ',' ORDER BY id)) AS ck
         FROM expenses WHERE period_id = :untouched`,
        { untouched }
      );
    const before = await checksum();
    const { id } = await Income.findOne({ where: { periodId: await periodOf('2026-03-06') } });

    await incomes.updateIncome({ id, total: 100, currency: MXN, paymentDate: day('2026-03-06') });
    await createIncome('2026-07-03', MXN);

    expect(
      await rows(
        `SELECT period_id FROM (SELECT period_id, currency FROM expenses UNION ALL SELECT period_id, currency FROM incomes) r
         GROUP BY period_id HAVING COUNT(DISTINCT currency) > 1`
      )
    ).toEqual([]);
    expect(await checksum()).toEqual(before);
  });
});
