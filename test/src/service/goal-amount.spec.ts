import { describe, it, expect, beforeEach, vi } from 'vitest';
import { Sequelize } from 'sequelize';
import { GoalService } from '../../../src/service/goal-service.js';
import { GoalLinkedExpenseRow } from '../../../src/repository/goal-repository.js';
import { CurrencyCode } from '../../../src/generated/graphql.js';

const { MXN, USD } = CurrencyCode;

let service: GoalService;
let getRows: ReturnType<typeof vi.fn>;
let getConversionRate: ReturnType<typeof vi.fn>;

const row = (id: string, values: Partial<GoalLinkedExpenseRow>): GoalLinkedExpenseRow => ({
  id,
  total: '100.00',
  currency: USD,
  originalTotal: null,
  originalCurrency: null,
  payBefore: new Date('2026-10-01T00:00:00Z'),
  goalCurrency: USD,
  ...values,
});

beforeEach(() => {
  getRows = vi.fn();
  getConversionRate = vi.fn();
  service = new GoalService('user', new Sequelize('sqlite::memory:', { logging: false }));
  Object.assign(service.goalRepository, { getGoalLinkedExpenseRows: getRows });
  Object.assign(service, { exchangeRates: { getConversionRate } });
});

describe('GoalService.getGoalAmountsByExpenseIds', () => {
  it('uses total when the expense currency is the goal currency', async () => {
    getRows.mockResolvedValue([row('a', { total: '1234.50' })]);

    expect(await service.getGoalAmountsByExpenseIds(['a'])).toEqual(['$1,234.50']);
    expect(getConversionRate).not.toHaveBeenCalled();
  });

  it('uses original_total when the original currency is the goal currency', async () => {
    getRows.mockResolvedValue([
      row('a', { total: '2000.00', currency: MXN, originalTotal: '105.25', originalCurrency: USD }),
    ]);

    expect(await service.getGoalAmountsByExpenseIds(['a'])).toEqual(['$105.25']);
    expect(getConversionRate).not.toHaveBeenCalled();
  });

  it('converts total at the pay_before rate otherwise, half-up to 2 decimals', async () => {
    getRows.mockResolvedValue([row('a', { total: '1000.00', currency: MXN })]);
    getConversionRate.mockResolvedValue({ rate: '0.0545455000', rateDate: '2026-10-01' });

    expect(await service.getGoalAmountsByExpenseIds(['a'])).toEqual(['$54.55']);
    expect(getConversionRate).toHaveBeenCalledWith(MXN, USD, '2026-10-01');
  });

  it('rounds exact halves up', async () => {
    getRows.mockResolvedValue([row('a', { total: '0.50', currency: MXN })]);
    getConversionRate.mockResolvedValue({ rate: '0.0100000000', rateDate: '2026-10-01' });

    expect(await service.getGoalAmountsByExpenseIds(['a'])).toEqual(['$0.01']);
  });

  it('converts in the inverse direction (USD expense on an MXN goal)', async () => {
    getRows.mockResolvedValue([row('a', { total: '10.00', currency: USD, goalCurrency: MXN })]);
    getConversionRate.mockResolvedValue({ rate: '18.3333333333', rateDate: '2026-10-01' });

    expect(await service.getGoalAmountsByExpenseIds(['a'])).toEqual(['$183.33']);
    expect(getConversionRate).toHaveBeenCalledWith(USD, MXN, '2026-10-01');
  });

  it('makes one rate call per distinct date and direction', async () => {
    getRows.mockResolvedValue([
      row('a', { currency: MXN }),
      row('b', { currency: MXN }),
      row('c', { currency: MXN, payBefore: new Date('2026-10-02T00:00:00Z') }),
      row('d', { currency: USD, goalCurrency: MXN }),
    ]);
    getConversionRate.mockResolvedValue({ rate: '1.0000000000', rateDate: '2026-10-01' });

    await service.getGoalAmountsByExpenseIds(['a', 'b', 'c', 'd']);

    expect(getConversionRate).toHaveBeenCalledTimes(3);
  });

  it('returns null for a missing rate without failing the others', async () => {
    getRows.mockResolvedValue([
      row('a', { currency: MXN, payBefore: new Date('2021-01-01T00:00:00Z') }),
      row('b', { total: '5.00' }),
    ]);
    getConversionRate.mockRejectedValue(new Error('Exchange rate unavailable'));

    expect(await service.getGoalAmountsByExpenseIds(['a', 'b', 'missing'])).toEqual([
      null,
      '$5.00',
      null,
    ]);
  });
});

describe('GoalService.createGoal currency', () => {
  const input = { name: 'Trip', targetAmount: 100, startDate: '2026-01-01' };
  const goal = { id: 'g', userId: 'user', ...input, endDate: null, currency: USD };

  it('defaults to the user default currency', async () => {
    const createGoal = vi.fn().mockResolvedValue(goal);
    Object.assign(service.goalRepository, { createGoal });
    Object.assign(service, {
      userSettingsService: { getDefaultCurrency: vi.fn().mockResolvedValue(MXN) },
    });

    await service.createGoal(input);

    expect(createGoal).toHaveBeenCalledWith(expect.objectContaining({ currency: MXN }));
  });

  it('keeps an explicit currency', async () => {
    const createGoal = vi.fn().mockResolvedValue(goal);
    const getDefaultCurrency = vi.fn();
    Object.assign(service.goalRepository, { createGoal });
    Object.assign(service, { userSettingsService: { getDefaultCurrency } });

    await service.createGoal({ ...input, currency: MXN });

    expect(createGoal).toHaveBeenCalledWith(expect.objectContaining({ currency: MXN }));
    expect(getDefaultCurrency).not.toHaveBeenCalled();
  });

  it('leaves the currency out of an update that omits it, and changes it when given', async () => {
    const updateGoal = vi.fn().mockResolvedValue(goal);
    Object.assign(service.goalRepository, {
      updateGoal,
      getGoalByPk: vi.fn().mockResolvedValue(goal),
    });

    await service.updateGoal({ ...input, id: 'g' });
    await service.updateGoal({ ...input, id: 'g', currency: MXN });

    expect(updateGoal.mock.calls[0][1]).not.toHaveProperty('currency');
    expect(updateGoal.mock.calls[1][1]).toHaveProperty('currency', MXN);
  });
});
