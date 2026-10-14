import { Sequelize, Transaction } from 'sequelize';
import { CurrencyCode, FixedExpenseFrequency } from '../../../src/generated/graphql.js';
import { initModels } from '../../../src/models/init-models.js';
import { associateModels } from '../../../src/models/associations.js';
import { Card, Category, Expense, Income, SubCategory } from '../../../src/models/index.js';
import { ExpensesService } from '../../../src/service/expenses-service.js';
import { IncomeRepository } from '../../../src/repository/income-repository.js';
import { IncomeService } from '../../../src/service/income-service.js';
import { UserSettingsRepository } from '../../../src/repository/user-settings-repository.js';
import { updateCard } from '../../../src/resolvers/mutation/card/update-card.js';
import { adaptCardDTO } from '../../../src/adapters/card-adapter.js';
import { adaptCard, adaptExpensesDTOInput, adaptIncome } from '../../../src/adapters/income-adapter.js';
import { adaptSingleRawExpenseDTO } from '../../../src/adapters/expense-adapter.js';

const userId = '11111111-1111-4111-8111-111111111111';
const aprilDate = '2026-04-03';
let sequelize: Sequelize;
let subCategoryId: string;
let expenses: ExpensesService;
let incomes: IncomeService;

const { MXN, USD } = CurrencyCode;

const setDefault = (currency: CurrencyCode) =>
  new UserSettingsRepository(userId).setDefaultCurrency(currency);

const createIncome = (paymentDate: string, currency?: CurrencyCode, total = 1000) =>
  incomes.createIncome({ total, currency, paymentDate: paymentDate as unknown as Date });

const incomePeriodId = async (paymentDate: string, currency?: CurrencyCode) => {
  await createIncome(paymentDate, currency);
  return (await Income.findOne({ order: [['paymentDate', 'DESC']] })).periodId;
};

const createExpense = (periodId: string, payBefore = new Date(`${aprilDate}T00:00:00Z`)) =>
  expenses.createExpense({
    concept: 'Rent',
    total: 100,
    periodId,
    payBefore,
    categoryId: 'unused',
    subCategoryId,
  });

const currencies = async () =>
  (await Expense.findAll({ order: [['payBefore', 'ASC']] })).map((e) => e.currency);

beforeEach(async () => {
  sequelize = new Sequelize('sqlite::memory:', { logging: false });
  initModels(sequelize);
  associateModels();
  await sequelize.sync({ force: true });
  await sequelize.query('PRAGMA foreign_keys = OFF');
  const category = await Category.create({ name: 'Home', userId: null });
  subCategoryId = (
    await SubCategory.create({ name: 'Rent', userId: null, categoryId: category.id })
  ).id;
  expenses = new ExpensesService(userId, sequelize);
  incomes = new IncomeService(userId, sequelize);
});

describe('expense currency', () => {
  it('takes the currency of the income of its period', async () => {
    await setDefault(USD);
    const periodId = await incomePeriodId(aprilDate, MXN);

    const created = await createExpense(periodId);

    expect(created.currency).toBe(MXN);
  });

  it('falls back to the user default when the period has no income', async () => {
    const withoutSetting = await createExpense('00000000-0000-4000-8000-000000000009');
    expect(withoutSetting.currency).toBe(USD);

    await setDefault(MXN);
    const withSetting = await createExpense('00000000-0000-4000-8000-000000000009');
    expect(withSetting.currency).toBe(MXN);
  });

  it('derives the currency per repetition of a fixed expense', async () => {
    await setDefault(USD);
    await incomePeriodId(aprilDate, MXN);

    await expenses.createFixedExpenses({
      concept: 'Rent',
      total: 100,
      payBefore: new Date('2026-04-03T00:00:00Z'),
      categoryId: 'unused',
      subCategoryId,
      numberOfRepetitions: 2,
      frequency: FixedExpenseFrequency.MONTHLY,
    });

    expect(await currencies()).toEqual([MXN, USD]);
  });

  describe('update', () => {
    const payBefore = new Date('2026-04-04T00:00:00Z');
    const input = { concept: 'Rent', total: 100, subCategoryId, payBefore };

    // sqlite cannot return rows from UPDATE, so the repositories are stubbed
    const stubUpdate = (currentPeriodId: string | null, targetCurrency: CurrencyCode | null) => {
      const updateExpense = vi.fn().mockResolvedValue({});
      const getCurrencyByPeriod = vi.fn().mockResolvedValue(targetCurrency);
      Object.assign(expenses, {
        expenseRepository: {
          getPeriodId: vi.fn().mockResolvedValue(currentPeriodId),
          updateExpense,
        },
        incomeRepository: { getCurrencyByPeriod },
        periodRepository: { getPeriodBy: vi.fn().mockResolvedValue({ id: 'new-period' }) },
      });
      return { updateExpense, getCurrencyByPeriod };
    };

    it('keeps the currency when the period does not change', async () => {
      const { updateExpense, getCurrencyByPeriod } = stubUpdate('new-period', USD);

      await expenses.updateExpense('e-1', input);

      expect(getCurrencyByPeriod).not.toHaveBeenCalled();
      expect(updateExpense.mock.calls[0][1]).not.toHaveProperty('currency');
    });

    it('re-derives the currency from the income of the new period', async () => {
      const { updateExpense } = stubUpdate('old-period', USD);

      await expenses.updateExpense('e-1', input);

      expect(updateExpense.mock.calls[0][1]).toMatchObject({
        periodId: 'new-period',
        currency: USD,
      });
    });

    it('uses the user default when the new period has no income', async () => {
      await setDefault(MXN);
      const { updateExpense } = stubUpdate('old-period', null);

      await expenses.updateExpense('e-1', input);

      expect(updateExpense.mock.calls[0][1]).toMatchObject({ currency: MXN });
    });
  });
});

describe('income currency', () => {
  it('defaults to USD, then the user setting, then an explicit value', async () => {
    expect((await createIncome(aprilDate)).currency).toBe(USD);
    await Income.destroy({ where: {} });

    await setDefault(MXN);
    expect((await createIncome(aprilDate)).currency).toBe(MXN);
    await Income.destroy({ where: {} });

    expect((await createIncome(aprilDate, USD)).currency).toBe(USD);
  });

  describe('update', () => {
    const where = { userId, periodId: 'period-2' };
    const transaction = { id: 'tx' } as unknown as Transaction;

    // sqlite cannot return rows from UPDATE, so the model calls are stubbed
    const runUpdate = async (
      stored: { currency: CurrencyCode; periodId: string },
      sent: { currency?: CurrencyCode; periodId: string }
    ) => {
      vi.spyOn(Income, 'findOne').mockResolvedValue({ id: 'i-1', ...stored } as never);
      const incomeUpdate = vi
        .spyOn(Income, 'update')
        .mockResolvedValue([1, [{ id: 'i-1' }]] as never);
      const expenseUpdate = vi.spyOn(Expense, 'update').mockResolvedValue([1] as never);

      await new IncomeRepository(userId, sequelize).updateIncome(
        { id: 'i-1', total: 10, ...sent },
        { transaction }
      );
      return { incomeUpdate, expenseUpdate };
    };

    afterEach(() => vi.restoreAllMocks());

    it('relabels the period in the caller transaction when the currency changes', async () => {
      const { incomeUpdate, expenseUpdate } = await runUpdate(
        { currency: MXN, periodId: 'period-2' },
        { currency: USD, periodId: 'period-2' }
      );

      expect(expenseUpdate).toHaveBeenCalledWith({ currency: USD }, { where, transaction });
      expect(incomeUpdate).toHaveBeenCalledWith({ currency: USD }, { where, transaction });
    });

    it('relabels the destination period when the income moves to another period', async () => {
      const { expenseUpdate } = await runUpdate(
        { currency: MXN, periodId: 'period-1' },
        { periodId: 'period-2' }
      );

      expect(expenseUpdate).toHaveBeenCalledWith({ currency: MXN }, { where, transaction });
    });

    it('leaves the expenses alone when neither currency nor period changes', async () => {
      const { expenseUpdate } = await runUpdate(
        { currency: MXN, periodId: 'period-2' },
        { currency: MXN, periodId: 'period-2' }
      );

      expect(expenseUpdate).not.toHaveBeenCalled();
    });
  });

  it('retags fallback-currency expenses when the first income of their period is created', async () => {
    await expenses.createFixedExpenses({
      concept: 'Rent',
      total: 100,
      payBefore: new Date('2026-04-03T00:00:00Z'),
      categoryId: 'unused',
      subCategoryId,
      numberOfRepetitions: 2,
      frequency: FixedExpenseFrequency.MONTHLY,
    });
    expect(await currencies()).toEqual([USD, USD]);

    await createIncome('2026-05-03', MXN);

    expect(await currencies()).toEqual([USD, MXN]);
  });

  it('relabels the existing income and expenses on an explicit different currency', async () => {
    const periodId = await incomePeriodId(aprilDate, MXN);
    await createExpense(periodId);

    await createIncome(aprilDate, USD);

    expect(await Income.count()).toBe(1);
    expect((await Income.findOne()).currency).toBe(USD);
    expect(await currencies()).toEqual([USD]);
  });

  it('keeps the existing currency when none is sent for an existing period', async () => {
    await setDefault(USD);
    const periodId = await incomePeriodId(aprilDate, MXN);
    await createExpense(periodId);

    await createIncome(aprilDate, undefined, 2000);

    expect((await Income.findOne()).currency).toBe(MXN);
    expect(await currencies()).toEqual([MXN]);
  });
});

describe('card currency', () => {
  afterEach(() => vi.restoreAllMocks());

  type CardResolver = (
    parent: unknown,
    args: { input: Record<string, unknown> },
    context: unknown
  ) => Promise<{ currency: string | null }>;
  const run = (input: Record<string, unknown>) =>
    (updateCard as unknown as CardResolver)({}, { input }, { user: { userId } });

  const spyUpdate = () =>
    vi
      .spyOn(Card, 'update')
      .mockResolvedValue([1, [{ id: 'card-1', bank: 'Banregio', currency: MXN }]] as never);

  it('passes the currency to the update', async () => {
    const update = spyUpdate();

    const updated = await run({ id: 'card-1', bank: 'Banregio', currency: MXN });

    expect(update.mock.calls[0][0]).toMatchObject({ currency: MXN });
    expect(updated.currency).toBe(MXN);
  });

  it('leaves the currency out of the update when omitted or null', async () => {
    const update = spyUpdate();

    await run({ id: 'card-1', bank: 'Banregio' });
    await run({ id: 'card-1', bank: 'Banregio', currency: null });

    expect(update.mock.calls[0][0]).not.toHaveProperty('currency');
    expect(update.mock.calls[1][0]).not.toHaveProperty('currency');
  });
});

describe('adapters expose currency', () => {
  const now = new Date('2026-04-03T00:00:00Z');

  it('maps card currency, null when unset', () => {
    const base = { id: '1', userId, bank: 'b', alias: 'a', isDebit: false, isDigital: false };
    expect(adaptCardDTO({ ...base, currency: MXN }).currency).toBe(MXN);
    expect(adaptCardDTO(base).currency).toBeNull();
    expect(adaptCard({ ...base, currency: USD } as unknown as Card).currency).toBe(USD);
  });

  it('maps income currency', () => {
    const income = adaptIncome({
      id: '1', userId, total: 10, currency: MXN,
      paymentDate: now, createdAt: now, updatedAt: now,
    });
    expect(income.currency).toBe(MXN);
  });

  it('maps expense currency from the raw row to GraphQL, total string unchanged', () => {
    const dto = adaptSingleRawExpenseDTO({
      id: '1', userId, total: 1234.5, currency: MXN, concept: 'x',
      payBefore: now, createdAt: now, updatedAt: now,
      sub_category: { id: 's', name: 'sub', category: { id: 'c', name: 'cat' } },
    });
    expect(dto.currency).toBe(MXN);

    const graphql = adaptExpensesDTOInput(dto);
    expect(graphql.currency).toBe(MXN);
    expect(graphql.total).toBe('$1,234.50');
  });
});
