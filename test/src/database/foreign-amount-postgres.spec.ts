import { QueryTypes, Sequelize } from 'sequelize';
import type { Mock } from 'vitest';
import type { FixRate } from '../../../src/clients/banxico/fx-client.js';
import { associateModels } from '../../../src/models/associations.js';
import { initModels } from '../../../src/models/init-models.js';
import { Category, Expense, Income, SubCategory } from '../../../src/models/index.js';
import { CurrencyCode } from '../../../src/generated/graphql.js';
import { ExchangeRateRepository } from '../../../src/repository/exchange-rate-repository.js';
import { repriceForeignExpenses } from '../../../src/repository/foreign-expense-reprice.js';
import { ExchangeRateService } from '../../../src/service/exchange-rate-service.js';
import { ExpensesService } from '../../../src/service/expenses-service.js';
import { IncomeService } from '../../../src/service/income-service.js';

// Needs a Postgres server; set CURRENCY_MIGRATION_TEST_URL=postgres://user:pw@host:port/postgres
const url = process.env.CURRENCY_MIGRATION_TEST_URL;
const dbName = 'foreign_amount_test';
const userId = '11111111-1111-4111-8111-111111111111';
const otherUserId = '22222222-2222-4222-8222-222222222222';
const NOW = new Date('2026-10-13T18:00:00Z');
const { MXN, USD } = CurrencyCode;

describe.skipIf(!url)('foreign amounts on Postgres', () => {
  let admin: Sequelize;
  let db: Sequelize;
  let expenses: ExpensesService;
  let incomes: IncomeService;
  let rates: ExchangeRateRepository;
  let fetchRates: Mock<(start: string, end: string) => Promise<FixRate[]>>;
  let subCategoryId: string;

  const day = (date: string) => new Date(`${date}T00:00:00Z`);
  const cacheRates = (values: Record<string, number>) =>
    rates.upsertMany(
      Object.entries(values).map(([rateDate, rate]) => ({
        base: USD,
        quote: MXN,
        rateDate,
        rate,
        source: 'BANXICO_FIX',
      }))
    );
  const rows = <T extends object>(sql: string, replacements = {}) =>
    db.query<T>(sql, { type: QueryTypes.SELECT, replacements });
  const expenseRows = () =>
    rows<{
      concept: string;
      total: string;
      currency: string;
      exchange_rate: string | null;
      rate_date: string | null;
      rate_source: string | null;
      original_total: string | null;
      original_currency: string | null;
      fixed_rate: boolean;
    }>(
      `SELECT concept, total::text, currency, exchange_rate::text, rate_date::text, rate_source,
              original_total::text, original_currency, fixed_rate
       FROM expenses ORDER BY concept`
    );
  const createIncome = (paymentDate: string, currency: CurrencyCode) =>
    incomes.createIncome({ total: 100, currency, paymentDate: paymentDate as unknown as Date });
  const periodOf = async (incomeDate: string) =>
    (await Income.findOne({ where: { paymentDate: day(incomeDate) } })).periodId;

  const insertExpense = (
    concept: string,
    payBefore: string,
    values: {
      total: number;
      currency: CurrencyCode;
      original?: [number, CurrencyCode, number, string];
      fixed?: boolean;
      userId?: string;
    }
  ) =>
    Expense.create({
      userId: values.userId ?? userId,
      concept,
      total: values.total,
      currency: values.currency,
      payBefore: day(payBefore),
      periodId: '00000000-0000-4000-8000-000000000001',
      subCategoryId,
      ...(values.original && {
        originalTotal: values.original[0],
        originalCurrency: values.original[1],
        exchangeRate: values.original[2],
        rateDate: values.original[3],
        rateSource: values.fixed ? 'MANUAL' : 'BANXICO_FIX',
        fixedRate: values.fixed ?? false,
      }),
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
    rates = new ExchangeRateRepository();
    fetchRates = vi.fn<(start: string, end: string) => Promise<FixRate[]>>().mockResolvedValue([]);
    expenses = new ExpensesService(userId, db);
    incomes = new IncomeService(userId, db);
    Object.assign(expenses, {
      exchangeRates: new ExchangeRateService({ repository: rates, fetchRates, now: () => NOW }),
    });
  });

  describe('create and update through the service', () => {
    const createForeign = async (periodId: string, payBefore: string, amount: number, fixed = false, total = 1) =>
      expenses.createExpense({
        concept: 'Trip',
        total,
        periodId,
        payBefore: day(payBefore),
        categoryId: 'unused',
        subCategoryId,
        foreignAmount: { amount, currency: USD, fixedRate: fixed },
      });

    const update = (id: string, payBefore: string, total: number, extra = {}) =>
      expenses.updateExpense(id, { concept: 'Trip', total, subCategoryId, payBefore: day(payBefore), ...extra });

    it('stores the converted total, the rate and the foreign amount', async () => {
      await cacheRates({ '2026-04-03': 17.5 });
      await createIncome('2026-04-03', MXN);

      const created = await createForeign(await periodOf('2026-04-03'), '2026-04-04', 12.34);

      expect(Number(created.total)).toBe(215.95);
      expect(await expenseRows()).toEqual([
        {
          concept: 'Trip',
          total: '215.95',
          currency: 'MXN',
          exchange_rate: '17.5000000000',
          rate_date: '2026-04-03',
          rate_source: 'BANXICO_FIX',
          original_total: '12.34',
          original_currency: 'USD',
          fixed_rate: false,
        },
      ]);
    });

    it('re-prices on a date change, then becomes domestic on an explicit null', async () => {
      await cacheRates({ '2026-04-03': 17.5, '2026-04-10': 18 });
      await createIncome('2026-04-03', MXN);
      const { id } = await createForeign(await periodOf('2026-04-03'), '2026-04-04', 100);

      const moved = await update(id, '2026-04-10', 1750);
      expect(Number(moved.total)).toBe(1800);
      expect(moved.foreignAmount).toMatchObject({ rate: 18, rateDate: '2026-04-10', fixedRate: false });

      const domestic = await update(id, '2026-04-10', 1700, { foreignAmount: null });
      expect(Number(domestic.total)).toBe(1700);
      expect(domestic.foreignAmount).toBeNull();
      expect((await expenseRows())[0]).toMatchObject({
        original_total: null,
        exchange_rate: null,
        rate_date: null,
        rate_source: null,
        fixed_rate: false,
      });
    });

    it('keeps a fixed-rate total when only the date moves', async () => {
      await createIncome('2026-04-03', MXN);
      const { id } = await createForeign(await periodOf('2026-04-03'), '2026-04-04', 100, true, 1800);

      const moved = await update(id, '2026-04-08', 1800);

      expect(Number(moved.total)).toBe(1800);
      expect(moved.foreignAmount).toMatchObject({
        rate: 18,
        rateDate: '2026-04-08',
        rateSource: 'MANUAL',
        fixedRate: true,
      });
    });

    it('rejects moving a foreign expense into a period with another currency', async () => {
      await cacheRates({ '2026-04-03': 17.5 });
      await createIncome('2026-04-03', MXN);
      await createIncome('2026-05-01', USD);
      const { id } = await createForeign(await periodOf('2026-04-03'), '2026-04-04', 100);

      await expect(update(id, '2026-05-02', 1750)).rejects.toMatchObject({
        extensions: { code: 'VALIDATION_ERROR', argumentName: 'payBefore' },
      });
      expect((await expenseRows())[0]).toMatchObject({ total: '1750.00', currency: 'MXN' });
    });

    describe('income edits', () => {
      const setup = async () => {
        await cacheRates({ '2026-04-03': 17.5 });
        await createIncome('2026-04-03', MXN);
        await createIncome('2026-05-01', USD);
        await createForeign(await periodOf('2026-04-03'), '2026-04-04', 100);
        return {
          mxn: await Income.findOne({ where: { paymentDate: day('2026-04-03') } }),
          usd: await Income.findOne({ where: { paymentDate: day('2026-05-01') } }),
        };
      };

      it('rejects a currency change in a period with foreign expenses', async () => {
        const { mxn } = await setup();

        await expect(
          incomes.updateIncome({ id: mxn.id, total: 100, currency: USD, paymentDate: day('2026-04-03') })
        ).rejects.toMatchObject({ extensions: { code: 'VALIDATION_ERROR', argumentName: 'currency' } });
        expect((await mxn.reload()).currency).toBe('MXN');
        expect((await expenseRows())[0]).toMatchObject({ currency: 'MXN', original_currency: 'USD' });
      });

      it('rejects moving an income of another currency into that period', async () => {
        const { usd } = await setup();

        await expect(
          incomes.updateIncome({ id: usd.id, total: 100, paymentDate: day('2026-04-03') })
        ).rejects.toMatchObject({ extensions: { code: 'VALIDATION_ERROR', argumentName: 'paymentDate' } });
        expect((await usd.reload()).currency).toBe('USD');
      });

      it('allows edits that keep the period currency and keeps relabeling domestic periods', async () => {
        const { mxn, usd } = await setup();

        await incomes.updateIncome({ id: mxn.id, total: 500, currency: MXN, paymentDate: day('2026-04-03') });
        await incomes.updateIncome({ id: usd.id, total: 100, currency: MXN, paymentDate: day('2026-05-01') });

        expect((await usd.reload()).currency).toBe('MXN');
        expect((await mxn.reload()).total).toBe(500);
      });
    });
  });

  describe('re-pricing', () => {
    it('re-prices only unfixed foreign expenses with a newer rate on or before their date', async () => {
      await cacheRates({ '2026-10-05': 18, '2026-10-07': 19, '2026-10-09': 20, '2026-10-12': 21 });
      await insertExpense('stale', '2026-10-10', { total: 1800, currency: MXN, original: [100, USD, 18, '2026-10-05'] });
      await insertExpense('exact', '2026-10-09', { total: 2000, currency: MXN, original: [100, USD, 20, '2026-10-09'] });
      await insertExpense('fixed', '2026-10-10', {
        total: 1800,
        currency: MXN,
        original: [100, USD, 18, '2026-10-05'],
        fixed: true,
      });
      await insertExpense('future-rate', '2026-10-08', { total: 1800, currency: MXN, original: [100, USD, 18, '2026-10-05'] });
      await insertExpense('domestic', '2026-10-10', { total: 500, currency: MXN });

      const updated = await repriceForeignExpenses(db);

      expect(updated).toBe(2);
      expect(await expenseRows()).toMatchObject([
        { concept: 'domestic', total: '500.00', exchange_rate: null },
        { concept: 'exact', total: '2000.00', rate_date: '2026-10-09' },
        { concept: 'fixed', total: '1800.00', exchange_rate: '18.0000000000', rate_date: '2026-10-05', fixed_rate: true },
        { concept: 'future-rate', total: '1900.00', exchange_rate: '19.0000000000', rate_date: '2026-10-07' },
        { concept: 'stale', total: '2000.00', exchange_rate: '20.0000000000', rate_date: '2026-10-09' },
      ]);
    });

    it('is idempotent', async () => {
      await cacheRates({ '2026-10-05': 18, '2026-10-09': 20 });
      await insertExpense('a', '2026-10-10', { total: 1800, currency: MXN, original: [100, USD, 18, '2026-10-05'] });

      expect(await repriceForeignExpenses(db)).toBe(1);
      const first = await expenseRows();
      expect(await repriceForeignExpenses(db)).toBe(0);
      expect(await expenseRows()).toEqual(first);
    });

    it('never moves an expense back to an older rate', async () => {
      await cacheRates({ '2026-10-05': 18 });
      await insertExpense('a', '2026-10-10', { total: 2000, currency: MXN, original: [100, USD, 20, '2026-10-09'] });

      expect(await repriceForeignExpenses(db)).toBe(0);
      expect((await expenseRows())[0]).toMatchObject({ total: '2000.00', rate_date: '2026-10-09' });
    });

    it('uses the inverse rate rounded to 10 decimals for MXN expenses in USD periods', async () => {
      await cacheRates({ '2026-10-05': 18, '2026-10-09': 16.384 });
      await insertExpense('a', '2026-10-10', { total: 100, currency: USD, original: [1800, MXN, 0.0555555556, '2026-10-05'] });

      await repriceForeignExpenses(db);

      expect((await expenseRows())[0]).toMatchObject({
        exchange_rate: '0.0610351563',
        rate_date: '2026-10-09',
        total: '109.86',
      });
    });

    it('rounds half-up at 2 decimals', async () => {
      await cacheRates({ '2026-10-05': 18, '2026-10-09': 18.5 });
      await insertExpense('a', '2026-10-10', { total: 0.18, currency: MXN, original: [0.01, USD, 18, '2026-10-05'] });

      await repriceForeignExpenses(db);

      expect((await expenseRows())[0]).toMatchObject({ total: '0.19' });
    });

    it('re-prices the expenses of every user in one pass', async () => {
      await cacheRates({ '2026-10-05': 18, '2026-10-09': 20 });
      await insertExpense('mine', '2026-10-10', { total: 1800, currency: MXN, original: [100, USD, 18, '2026-10-05'] });
      await insertExpense('theirs', '2026-10-10', {
        total: 1800,
        currency: MXN,
        original: [100, USD, 18, '2026-10-05'],
        userId: otherUserId,
      });

      expect(await repriceForeignExpenses(db)).toBe(2);
    });

    it('runs when ensureRates caches new dates', async () => {
      await cacheRates({ '2026-10-05': 18 });
      await insertExpense('a', '2026-10-12', { total: 1800, currency: MXN, original: [100, USD, 18, '2026-10-05'] });
      fetchRates.mockResolvedValue([{ rateDate: '2026-10-09', rate: 19.5 }]);
      const service = new ExchangeRateService({
        repository: rates,
        fetchRates,
        now: () => NOW,
        onRatesCached: () => repriceForeignExpenses(db),
      });

      await service.ensureRates('2026-10-05', '2026-10-13', false);

      expect((await expenseRows())[0]).toMatchObject({ total: '1950.00', rate_date: '2026-10-09' });
    });
  });
});
