import { Sequelize } from 'sequelize';
import type { Mock } from 'vitest';
import type { FixRate } from '../../../src/clients/banxico/fx-client.js';
import { CurrencyCode, FixedExpenseFrequency } from '../../../src/generated/graphql.js';
import { adaptExpensesDTOInput } from '../../../src/adapters/income-adapter.js';
import { associateModels } from '../../../src/models/associations.js';
import { initModels } from '../../../src/models/init-models.js';
import { Category, Expense, Income, SubCategory } from '../../../src/models/index.js';
import { ExchangeRateRepository } from '../../../src/repository/exchange-rate-repository.js';
import { EXCHANGE_RATE_UNAVAILABLE, ExchangeRateService } from '../../../src/service/exchange-rate-service.js';
import { ExpensesService } from '../../../src/service/expenses-service.js';
import { UserSettingsRepository } from '../../../src/repository/user-settings-repository.js';
import { IncomeService } from '../../../src/service/income-service.js';

const { MXN, USD } = CurrencyCode;
const userId = '11111111-1111-4111-8111-111111111111';
const NOW = new Date('2026-10-13T18:00:00Z');

let sequelize: Sequelize;
let subCategoryId: string;
let expenses: ExpensesService;
let incomes: IncomeService;
let fetchRates: Mock<(start: string, end: string) => Promise<FixRate[]>>;

const day = (date: string) => new Date(`${date}T00:00:00Z`);

const cacheRates = (rows: Record<string, number>) =>
  new ExchangeRateRepository().upsertMany(
    Object.entries(rows).map(([rateDate, rate]) => ({
      base: USD,
      quote: MXN,
      rateDate,
      rate,
      source: 'BANXICO_FIX',
    }))
  );

const periodWithIncome = async (paymentDate: string, currency: CurrencyCode) => {
  await incomes.createIncome({ total: 1000, currency, paymentDate: paymentDate as unknown as Date });
  return (await Income.findOne({ order: [['paymentDate', 'DESC']] })).periodId;
};

const create = async (
  periodId: string,
  payBefore: string,
  foreignAmount: { amount: number; currency: CurrencyCode; fixedRate: boolean },
  total = 1
) =>
  expenses.createExpense({
    concept: 'Trip',
    total,
    periodId,
    payBefore: day(payBefore),
    categoryId: 'unused',
    subCategoryId,
    foreignAmount,
  });

const stored = () => Expense.findAll({ order: [['payBefore', 'ASC']], raw: true });

beforeEach(async () => {
  sequelize = new Sequelize('sqlite::memory:', { logging: false });
  initModels(sequelize);
  associateModels();
  await sequelize.sync({ force: true });
  await sequelize.query('PRAGMA foreign_keys = OFF');
  const category = await Category.create({ name: 'Home', userId: null });
  subCategoryId = (await SubCategory.create({ name: 'Rent', userId: null, categoryId: category.id })).id;
  fetchRates = vi.fn<(start: string, end: string) => Promise<FixRate[]>>().mockResolvedValue([]);
  expenses = new ExpensesService(userId, sequelize);
  incomes = new IncomeService(userId, sequelize);
  Object.assign(expenses, {
    exchangeRates: new ExchangeRateService({ repository: new ExchangeRateRepository(), fetchRates, now: () => NOW }),
  });
});

describe('createExpense with a foreign amount', () => {
  it('converts an unfixed amount at the rate of payBefore and stores the rate', async () => {
    await cacheRates({ '2026-04-02': 17.5, '2026-04-03': 17.6 });
    const periodId = await periodWithIncome('2026-04-03', MXN);

    const created = await create(periodId, '2026-04-04', { amount: 100, currency: USD, fixedRate: false });

    expect(created).toMatchObject({
      total: 1760,
      currency: MXN,
      foreignAmount: {
        amount: 100,
        currency: USD,
        rate: 17.6,
        rateDate: '2026-04-03',
        rateSource: 'BANXICO_FIX',
        fixedRate: false,
      },
    });
  });

  it('converts in the inverse direction', async () => {
    await cacheRates({ '2026-04-03': 17.5 });
    const periodId = await periodWithIncome('2026-04-03', USD);

    const created = await create(periodId, '2026-04-03', { amount: 1750, currency: MXN, fixedRate: false });

    expect(created).toMatchObject({ total: 100, currency: USD });
    expect(created.foreignAmount).toMatchObject({ currency: MXN, rate: 0.0571428571 });
  });

  it.each([
    [0.01, 18.5, 0.19],
    [0.5, 18.01, 9.01],
    [2, 1.0025, 2.01],
    [1, 0.005, 0.01],
  ])('rounds %s x %s half-up to %s', async (amount, rate, expected) => {
    await cacheRates({ '2026-04-03': rate });
    const periodId = await periodWithIncome('2026-04-03', MXN);

    const created = await create(periodId, '2026-04-03', { amount, currency: USD, fixedRate: false });

    expect(created.total).toBe(expected);
  });

  it('ignores the total sent by the client when the rate is not fixed', async () => {
    await cacheRates({ '2026-04-03': 17.5 });
    const periodId = await periodWithIncome('2026-04-03', MXN);

    const created = await create(periodId, '2026-04-03', { amount: 10, currency: USD, fixedRate: false }, 999);

    expect(created.total).toBe(175);
  });

  it('keeps the charged total for a fixed rate and derives the rate from it', async () => {
    const periodId = await periodWithIncome('2026-04-03', MXN);

    const created = await create(periodId, '2026-04-10', { amount: 100, currency: USD, fixedRate: true }, 1800);

    expect(created.total).toBe(1800);
    expect(created.foreignAmount).toEqual({
      amount: 100,
      currency: USD,
      rate: 18,
      rateDate: '2026-04-10',
      rateSource: 'MANUAL',
      fixedRate: true,
    });
    expect(fetchRates).not.toHaveBeenCalled();
  });

  it('requires a positive total for a fixed rate', async () => {
    const periodId = await periodWithIncome('2026-04-03', MXN);

    await expect(
      create(periodId, '2026-04-10', { amount: 100, currency: USD, fixedRate: true }, 0)
    ).rejects.toThrow('Total must not be negative or zero');
    await expect(
      create(periodId, '2026-04-10', { amount: 100, currency: USD, fixedRate: true }, null as never)
    ).rejects.toMatchObject({ extensions: { code: 'VALIDATION_ERROR', argumentName: 'total' } });
  });

  it('rejects a foreign currency equal to the period currency before writing', async () => {
    await cacheRates({ '2026-04-03': 17.5 });
    const periodId = await periodWithIncome('2026-04-03', MXN);

    await expect(
      create(periodId, '2026-04-03', { amount: 10, currency: MXN, fixedRate: false })
    ).rejects.toMatchObject({ extensions: { code: 'VALIDATION_ERROR', argumentName: 'foreignAmount' } });
    expect(await Expense.count()).toBe(0);
  });

  it('rejects amounts beyond the supported range', async () => {
    const periodId = await periodWithIncome('2026-04-03', MXN);

    await expect(
      create(periodId, '2026-04-03', { amount: 1e21, currency: USD, fixedRate: false })
    ).rejects.toMatchObject({ extensions: { code: 'VALIDATION_ERROR', argumentName: 'foreignAmount' } });
    await expect(
      create(periodId, '2026-04-03', { amount: 1e21, currency: USD, fixedRate: true }, 1)
    ).rejects.toMatchObject({ extensions: { code: 'VALIDATION_ERROR', argumentName: 'foreignAmount' } });
  });

  it('rejects a fixed total whose derived rate rounds to zero', async () => {
    const periodId = await periodWithIncome('2026-04-03', MXN);

    await expect(
      create(periodId, '2026-04-03', { amount: 9999999999, currency: USD, fixedRate: true }, 0.01)
    ).rejects.toMatchObject({ extensions: { code: 'VALIDATION_ERROR', argumentName: 'total' } });
  });

  it('rejects amounts that round to zero', async () => {
    await cacheRates({ '2026-04-03': 17.5 });
    const periodId = await periodWithIncome('2026-04-03', MXN);

    await expect(
      create(periodId, '2026-04-03', { amount: 0.004, currency: USD, fixedRate: false })
    ).rejects.toMatchObject({ extensions: { argumentName: 'foreignAmount' } });
  });

  it('fails with EXCHANGE_RATE_UNAVAILABLE when no rate exists', async () => {
    fetchRates.mockRejectedValue(new Error('down'));
    const periodId = await periodWithIncome('2026-04-03', MXN);

    await expect(
      create(periodId, '2026-04-03', { amount: 10, currency: USD, fixedRate: false })
    ).rejects.toMatchObject({ extensions: { code: EXCHANGE_RATE_UNAVAILABLE } });
    expect(await Expense.count()).toBe(0);
  });

  it('leaves a create without foreignAmount domestic, as old clients send it', async () => {
    const periodId = await periodWithIncome('2026-04-03', MXN);

    const created = await expenses.createExpense({
      concept: 'Rent',
      total: 100,
      periodId,
      payBefore: day('2026-04-04'),
      categoryId: 'unused',
      subCategoryId,
    });

    expect(created).toMatchObject({ total: 100, currency: MXN, foreignAmount: null });
    expect((await stored())[0]).toMatchObject({
      originalTotal: null,
      originalCurrency: null,
      exchangeRate: null,
      rateDate: null,
      rateSource: null,
      fixedRate: 0,
    });
    expect(adaptExpensesDTOInput(created).foreignAmount).toBeNull();
  });

  it('formats the foreign amount for GraphQL', async () => {
    await cacheRates({ '2026-04-03': 17.5 });
    const periodId = await periodWithIncome('2026-04-03', MXN);

    const created = await create(periodId, '2026-04-03', { amount: 1234.5, currency: USD, fixedRate: false });

    expect(adaptExpensesDTOInput(created).foreignAmount).toEqual({
      amount: '$1,234.50',
      currency: USD,
      rate: 17.5,
      rateDate: day('2026-04-03'),
      rateSource: 'BANXICO_FIX',
      fixedRate: false,
    });
  });
});

describe('createFixedExpenses with a foreign amount', () => {
  const series = (foreignAmount, total = 1) => ({
    concept: 'Plan',
    total,
    payBefore: day('2026-01-05'),
    categoryId: 'unused',
    subCategoryId,
    numberOfRepetitions: 3,
    frequency: FixedExpenseFrequency.MONTHLY,
    foreignAmount,
  });

  it('prices each repetition with the rate of its own date', async () => {
    await cacheRates({ '2026-01-05': 17, '2026-02-05': 18, '2026-03-05': 19 });
    await periodWithIncome('2026-01-05', MXN);
    await periodWithIncome('2026-02-05', MXN);
    await periodWithIncome('2026-03-05', MXN);

    await expenses.createFixedExpenses(series({ amount: 10, currency: USD, fixedRate: false }));

    expect((await stored()).map((e) => [e.total, e.exchangeRate, e.rateDate, e.rateSource])).toEqual([
      [170, 17, '2026-01-05', 'BANXICO_FIX'],
      [180, 18, '2026-02-05', 'BANXICO_FIX'],
      [190, 19, '2026-03-05', 'BANXICO_FIX'],
    ]);
  });

  it('converts into the currency of each period, falling back to the user default without an income', async () => {
    await new UserSettingsRepository(userId).setDefaultCurrency(USD);
    await cacheRates({ '2026-01-05': 20, '2026-02-05': 25 });
    await periodWithIncome('2026-01-05', USD);

    await expenses.createFixedExpenses({
      ...series({ amount: 100, currency: MXN, fixedRate: false }),
      numberOfRepetitions: 2,
    });

    expect((await stored()).map((e) => [e.currency, e.total, e.exchangeRate, e.rateDate])).toEqual([
      [USD, 5, 0.05, '2026-01-05'],
      [USD, 4, 0.04, '2026-02-05'],
    ]);
  });

  it('keeps the charged total on every repetition of a fixed-rate series', async () => {
    await periodWithIncome('2026-01-05', MXN);
    await periodWithIncome('2026-02-05', MXN);
    await periodWithIncome('2026-03-05', MXN);

    await expenses.createFixedExpenses(series({ amount: 100, currency: USD, fixedRate: true }, 1800));

    expect((await stored()).map((e) => [e.total, e.exchangeRate, e.rateDate, e.rateSource, e.fixedRate])).toEqual([
      [1800, 18, '2026-01-05', 'MANUAL', 1],
      [1800, 18, '2026-02-05', 'MANUAL', 1],
      [1800, 18, '2026-03-05', 'MANUAL', 1],
    ]);
  });

  it('rejects the whole series when one repetition lands in a period of the foreign currency', async () => {
    await cacheRates({ '2026-01-05': 17 });
    await periodWithIncome('2026-01-05', MXN);
    await periodWithIncome('2026-02-05', USD);

    await expect(
      expenses.createFixedExpenses(series({ amount: 10, currency: USD, fixedRate: false }))
    ).rejects.toMatchObject({ extensions: { code: 'VALIDATION_ERROR', argumentName: 'foreignAmount' } });
    expect(await Expense.count()).toBe(0);
  });
});

describe('updateExpense and foreign amounts', () => {
  const base = { concept: 'Trip', subCategoryId };
  const foreignExpense = {
    periodId: 'period-1',
    payBefore: day('2026-04-04'),
    total: 1800,
    currency: MXN,
    originalTotal: '100.00',
    originalCurrency: USD,
    exchangeRate: '18.0000000000',
    rateDate: '2026-04-03',
    rateSource: 'BANXICO_FIX',
    fixedRate: false,
  };
  const domesticExpense = {
    ...foreignExpense,
    originalTotal: null,
    originalCurrency: null,
    exchangeRate: null,
    rateDate: null,
    rateSource: null,
  };

  // sqlite cannot return rows from UPDATE, so the repositories are stubbed; the Postgres spec runs the real writes
  const stub = (
    current: object,
    destinationCurrency: CurrencyCode | null = MXN,
    destinationPeriodId = 'period-1'
  ) => {
    const updateExpense = vi.fn().mockResolvedValue({});
    const getConversionRate = vi
      .fn()
      .mockResolvedValue({ rate: '19.0000000000', rateDate: '2026-04-10' });
    Object.assign(expenses, {
      expenseRepository: { getExpenseState: vi.fn().mockResolvedValue(current), updateExpense },
      incomeRepository: { getCurrencyByPeriod: vi.fn().mockResolvedValue(destinationCurrency) },
      periodRepository: { getPeriodBy: vi.fn().mockResolvedValue({ id: destinationPeriodId }) },
      exchangeRates: { getConversionRate },
    });
    return { updateExpense, getConversionRate };
  };
  const written = (updateExpense: Mock) => updateExpense.mock.calls[0][1];

  it('makes the expense domestic on an explicit null and keeps the sent total', async () => {
    const { updateExpense, getConversionRate } = stub(foreignExpense);

    await expenses.updateExpense('e-1', { ...base, total: 95, payBefore: day('2026-04-04'), foreignAmount: null });

    expect(written(updateExpense)).toMatchObject({
      total: 95,
      originalTotal: null,
      originalCurrency: null,
      exchangeRate: null,
      rateDate: null,
      rateSource: null,
      fixedRate: false,
    });
    expect(getConversionRate).not.toHaveBeenCalled();
  });

  it('keeps the foreign fields and the stored total when foreignAmount is omitted', async () => {
    const { updateExpense, getConversionRate } = stub(foreignExpense);

    await expenses.updateExpense('e-1', { ...base, total: 1, payBefore: day('2026-04-04'), concept: 'Renamed' });

    const patch = written(updateExpense);
    expect(patch).toMatchObject({ concept: 'Renamed' });
    expect(patch).not.toHaveProperty('total');
    expect(patch).not.toHaveProperty('originalTotal');
    expect(patch).not.toHaveProperty('fixedRate');
    expect(getConversionRate).not.toHaveBeenCalled();
  });

  it('does not re-price when the same foreign amount is resent', async () => {
    const { updateExpense, getConversionRate } = stub(foreignExpense);

    await expenses.updateExpense('e-1', {
      ...base,
      total: 1800,
      payBefore: day('2026-04-04'),
      foreignAmount: { amount: 100, currency: USD, fixedRate: false },
    });

    expect(getConversionRate).not.toHaveBeenCalled();
    expect(written(updateExpense)).not.toHaveProperty('total');
  });

  it('re-prices an unfixed expense when payBefore changes', async () => {
    const { updateExpense, getConversionRate } = stub(foreignExpense);

    await expenses.updateExpense('e-1', { ...base, total: 1800, payBefore: day('2026-04-10') });

    expect(getConversionRate).toHaveBeenCalledWith(USD, MXN, '2026-04-10');
    expect(written(updateExpense)).toMatchObject({
      total: 1900,
      exchangeRate: '19.0000000000',
      rateDate: '2026-04-10',
      rateSource: 'BANXICO_FIX',
    });
  });

  it('re-prices when the amount or the currency changes', async () => {
    const { updateExpense, getConversionRate } = stub(foreignExpense);

    await expenses.updateExpense('e-1', {
      ...base,
      total: 1800,
      payBefore: day('2026-04-04'),
      foreignAmount: { amount: 200, currency: USD, fixedRate: false },
    });

    expect(getConversionRate).toHaveBeenCalledWith(USD, MXN, '2026-04-04');
    expect(written(updateExpense)).toMatchObject({ total: 3800, originalTotal: '200.00' });
  });

  it('turns a domestic expense into a foreign one', async () => {
    const { updateExpense } = stub(domesticExpense);

    await expenses.updateExpense('e-1', {
      ...base,
      total: 1,
      payBefore: day('2026-04-04'),
      foreignAmount: { amount: 10, currency: USD, fixedRate: false },
    });

    expect(written(updateExpense)).toMatchObject({ total: 190, originalCurrency: USD, fixedRate: false });
  });

  it('switches to a fixed rate with the charged total', async () => {
    const { updateExpense, getConversionRate } = stub(foreignExpense);

    await expenses.updateExpense('e-1', {
      ...base,
      total: 1750,
      payBefore: day('2026-04-04'),
      foreignAmount: { amount: 100, currency: USD, fixedRate: true },
    });

    expect(getConversionRate).not.toHaveBeenCalled();
    expect(written(updateExpense)).toMatchObject({
      total: 1750,
      exchangeRate: '17.5000000000',
      rateSource: 'MANUAL',
      rateDate: '2026-04-04',
      fixedRate: true,
    });
  });

  describe('fixed rate', () => {
    const fixedExpense = { ...foreignExpense, fixedRate: true, rateSource: 'MANUAL' };

    it('keeps the total and never calls the rate service when nothing relevant changes', async () => {
      const { updateExpense, getConversionRate } = stub(fixedExpense);

      await expenses.updateExpense('e-1', { ...base, total: 1800, payBefore: day('2026-04-04') });

      expect(getConversionRate).not.toHaveBeenCalled();
      expect(written(updateExpense)).not.toHaveProperty('total');
      expect(written(updateExpense)).not.toHaveProperty('exchangeRate');
    });

    it('keeps the charged total and its rate when payBefore moves', async () => {
      const { updateExpense, getConversionRate } = stub(fixedExpense);

      await expenses.updateExpense('e-1', { ...base, total: 1800, payBefore: day('2026-04-10') });

      expect(getConversionRate).not.toHaveBeenCalled();
      expect(written(updateExpense)).toMatchObject({
        total: 1800,
        exchangeRate: '18.0000000000',
        rateDate: '2026-04-10',
        rateSource: 'MANUAL',
        fixedRate: true,
      });
    });

    it('derives a new rate when the user sends a new total', async () => {
      const { updateExpense } = stub(fixedExpense);

      await expenses.updateExpense('e-1', { ...base, total: 1900, payBefore: day('2026-04-04') });

      expect(written(updateExpense)).toMatchObject({ total: 1900, exchangeRate: '19.0000000000' });
    });

    it('switches back to a Banxico rate when fixedRate is turned off', async () => {
      const { updateExpense } = stub(fixedExpense);

      await expenses.updateExpense('e-1', {
        ...base,
        total: 1800,
        payBefore: day('2026-04-04'),
        foreignAmount: { amount: 100, currency: USD, fixedRate: false },
      });

      expect(written(updateExpense)).toMatchObject({ total: 1900, rateSource: 'BANXICO_FIX', fixedRate: false });
    });
  });

  describe('period currency rules', () => {
    it('rejects moving a foreign expense into a period with another currency', async () => {
      const { updateExpense } = stub(foreignExpense, USD, 'period-2');

      await expect(
        expenses.updateExpense('e-1', { ...base, total: 1800, payBefore: day('2026-05-04') })
      ).rejects.toMatchObject({ extensions: { code: 'VALIDATION_ERROR', argumentName: 'payBefore' } });
      expect(updateExpense).not.toHaveBeenCalled();
    });

    it('rejects that move even when a new foreign amount is sent', async () => {
      const { updateExpense } = stub(foreignExpense, USD, 'period-2');

      await expect(
        expenses.updateExpense('e-1', {
          ...base,
          total: 1,
          payBefore: day('2026-05-04'),
          foreignAmount: { amount: 50, currency: MXN, fixedRate: false },
        })
      ).rejects.toMatchObject({ extensions: { code: 'VALIDATION_ERROR', argumentName: 'payBefore' } });
      expect(updateExpense).not.toHaveBeenCalled();
    });

    it('never blocks a date move inside the same period and keeps the period currency', async () => {
      const { updateExpense } = stub(foreignExpense, USD);

      await expenses.updateExpense('e-1', { ...base, total: 1800, payBefore: day('2026-04-10') });

      expect(written(updateExpense)).toMatchObject({ total: 1900, currency: MXN });
    });

    it('rejects amounts outside the supported range with a VALIDATION_ERROR', async () => {
      stub(foreignExpense);

      await expect(
        expenses.updateExpense('e-1', {
          ...base,
          total: 1,
          payBefore: day('2026-04-04'),
          foreignAmount: { amount: 1e21, currency: USD, fixedRate: false },
        })
      ).rejects.toMatchObject({ extensions: { code: 'VALIDATION_ERROR', argumentName: 'foreignAmount' } });
    });

    it('rejects a foreign currency equal to the destination period currency', async () => {
      stub(domesticExpense);

      await expect(
        expenses.updateExpense('e-1', {
          ...base,
          total: 1,
          payBefore: day('2026-04-04'),
          foreignAmount: { amount: 10, currency: MXN, fixedRate: false },
        })
      ).rejects.toMatchObject({ extensions: { code: 'VALIDATION_ERROR', argumentName: 'foreignAmount' } });
    });

    it('lets a domestic expense move to another currency period', async () => {
      const { updateExpense } = stub(domesticExpense, USD);

      await expenses.updateExpense('e-1', { ...base, total: 100, payBefore: day('2026-05-04') });

      expect(updateExpense).toHaveBeenCalledTimes(1);
    });
  });
});

describe('income changes in a period with foreign expenses', () => {
  const foreignPeriod = async () => {
    await cacheRates({ '2026-04-03': 17.5 });
    const periodId = await periodWithIncome('2026-04-03', MXN);
    await create(periodId, '2026-04-04', { amount: 10, currency: USD, fixedRate: false });
    return periodId;
  };
  const createIncome = (paymentDate: string, currency?: CurrencyCode) =>
    incomes.createIncome({ total: 1000, currency, paymentDate: paymentDate as unknown as Date });

  it('rejects creating an income with another explicit currency in that period', async () => {
    await foreignPeriod();

    await expect(createIncome('2026-04-03', USD)).rejects.toMatchObject({
      extensions: { code: 'VALIDATION_ERROR', argumentName: 'currency' },
    });
    expect((await Income.findOne()).currency).toBe(MXN);
    expect((await Expense.findOne()).currency).toBe(MXN);
  });

  it('accepts an income with the same currency, or none', async () => {
    await foreignPeriod();

    await createIncome('2026-04-03', MXN);
    await createIncome('2026-04-03');

    expect(await Income.count()).toBe(1);
  });

  it('rejects the first income of a period whose fallback-tagged expenses are foreign', async () => {
    await cacheRates({ '2026-04-03': 17.5 });
    await expenses.createFixedExpenses({
      concept: 'Trip',
      total: 1,
      payBefore: day('2026-04-03'),
      categoryId: 'unused',
      subCategoryId,
      numberOfRepetitions: 1,
      frequency: FixedExpenseFrequency.MONTHLY,
      foreignAmount: { amount: 100, currency: MXN, fixedRate: false },
    });

    await expect(createIncome('2026-04-03', MXN)).rejects.toMatchObject({
      extensions: { code: 'VALIDATION_ERROR', argumentName: 'currency' },
    });
  });

  it('retags domestic fallback expenses when the first income arrives, as before', async () => {
    await expenses.createFixedExpenses({
      concept: 'Rent',
      total: 100,
      payBefore: day('2026-04-03'),
      categoryId: 'unused',
      subCategoryId,
      numberOfRepetitions: 1,
      frequency: FixedExpenseFrequency.MONTHLY,
    });

    await createIncome('2026-04-03', MXN);

    expect((await Expense.findOne()).currency).toBe(MXN);
  });
});
