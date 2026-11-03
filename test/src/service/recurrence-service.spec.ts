import { Sequelize } from 'sequelize';
import { FixedExpenseFrequency, RecurrenceScope } from '../../../src/generated/graphql.js';
import { ExpenseUpdate, RecurrenceService } from '../../../src/service/recurrence-service.js';

type PlanCall = (id: string, input: Partial<ExpenseUpdate>) => unknown;
type ApplyCall = (plan: { id: string; payBefore: Date }, transaction: unknown) => unknown;

const day = (iso: string) => new Date(`${iso}T00:00:00Z`);
const iso = (date: Date) => date.toISOString().slice(0, 10);
const today = day('2026-06-10');
const transaction = { id: 'tx' };

const seriesOf = (dates: string[]) =>
  dates.map((date, recurrenceIndex) => ({
    id: `e${recurrenceIndex}`,
    recurrenceId: 'r1',
    recurrenceIndex,
    payBefore: day(date),
    updatedAt: new Date(1),
    concept: 'Rent',
    total: '100.00',
    subCategoryId: 'sub-1',
    cardId: null,
    comments: null,
    goalId: null,
    goalRole: null,
    originalCurrency: null,
    originalTotal: null,
    fixedRate: false,
  }));

const monthly = seriesOf(['2026-04-15', '2026-05-15', '2026-06-15', '2026-07-15', '2026-08-15']);

const setup = (series = monthly, frequency = FixedExpenseFrequency.MONTHLY) => {
  const sequelize = { transaction: vi.fn((work) => work(transaction)) };
  const service = new RecurrenceService('user-1', sequelize as unknown as Sequelize, () => today);
  const expenseRepository = {
    getExpenseState: vi.fn((id: string) => series.find((expense) => expense.id === id) ?? null),
    getSeriesStates: vi.fn().mockResolvedValue(series),
    getSeriesExpenses: vi.fn().mockResolvedValue([]),
    deleteExpenses: vi.fn((ids: string[]) => ids.length),
  };
  const recurrenceRepository = {
    findById: vi.fn().mockResolvedValue({ id: 'r1', frequency }),
    updateFrequency: vi.fn(),
    delete: vi.fn(),
  };
  const expensesService = {
    updateExpense: vi.fn((id: string, input: Partial<ExpenseUpdate>) => ({ id, payBefore: input.payBefore })),
    planUpdate: vi.fn<PlanCall>((id, input) => ({ id, payBefore: input.payBefore, fields: input })),
    applyUpdate: vi.fn<ApplyCall>((plan) => ({ id: plan.id, payBefore: plan.payBefore })),
    deleteExpense: vi.fn().mockResolvedValue(true),
    planSeries: vi.fn((_, dates: Date[]) => dates.map((payBefore) => ({ payBefore }))),
    createSeriesExpenses: vi.fn().mockResolvedValue([]),
  };
  Object.assign(service, { expenseRepository, recurrenceRepository, expensesService });
  return { service, sequelize, expenseRepository, recurrenceRepository, expensesService };
};

const updatedDates = (planUpdate: ReturnType<typeof vi.fn<PlanCall>>) =>
  Object.fromEntries(planUpdate.mock.calls.map(([id, input]) => [id, iso(input.payBefore)]));

describe('RecurrenceService.updateExpense', () => {
  const edit = { concept: 'New rent', total: 120, subCategoryId: 'sub-1', payBefore: day('2026-06-17') };

  it('updates only the selected expense for THIS', async () => {
    const { service, expensesService } = setup();

    await service.updateExpense('e2', edit, RecurrenceScope.THIS);

    expect(expensesService.updateExpense).toHaveBeenCalledTimes(1);
    expect(expensesService.updateExpense).toHaveBeenCalledWith('e2', edit);
  });

  it('shifts this and following dates by the frequency for FOLLOWING', async () => {
    const { service, expensesService } = setup();

    await service.updateExpense('e2', edit, RecurrenceScope.FOLLOWING);

    expect(updatedDates(expensesService.planUpdate)).toEqual({
      e2: '2026-06-17',
      e3: '2026-07-17',
      e4: '2026-08-17',
    });
    expect(expensesService.planUpdate.mock.calls.every(([, input]) => input.concept === 'New rent')).toBe(true);
    expect(expensesService.applyUpdate).toHaveBeenCalledTimes(3);
    expect(expensesService.applyUpdate.mock.calls.every(([, tx]) => tx === transaction)).toBe(true);
  });

  it('applies fields to the whole series for ALL but keeps past dates', async () => {
    const { service, expensesService } = setup();

    await service.updateExpense('e2', edit, RecurrenceScope.ALL);

    expect(updatedDates(expensesService.planUpdate)).toEqual({
      e0: '2026-04-15',
      e1: '2026-05-15',
      e2: '2026-06-17',
      e3: '2026-07-17',
      e4: '2026-08-17',
    });
  });

  it('keeps every other date when the date did not change', async () => {
    const { service, expensesService } = setup(
      seriesOf(['2026-06-15', '2026-07-20', '2026-08-15'])
    );

    await service.updateExpense('e0', { ...edit, payBefore: day('2026-06-15') }, RecurrenceScope.ALL);

    expect(updatedDates(expensesService.planUpdate)).toEqual({
      e0: '2026-06-15',
      e1: '2026-07-20',
      e2: '2026-08-15',
    });
  });
});

describe('RecurrenceService.deleteExpense', () => {
  it('deletes this and following, keeping the series', async () => {
    const { service, expenseRepository, recurrenceRepository } = setup();

    const deleted = await service.deleteExpense('e3', RecurrenceScope.FOLLOWING);

    expect(deleted).toBe(2);
    expect(expenseRepository.deleteExpenses).toHaveBeenCalledWith(['e3', 'e4'], { transaction });
    expect(recurrenceRepository.delete).not.toHaveBeenCalled();
  });

  it('removes the series row when every expense is deleted', async () => {
    const { service, recurrenceRepository } = setup();

    await service.deleteExpense('e1', RecurrenceScope.ALL);

    expect(recurrenceRepository.delete).toHaveBeenCalledWith('r1', { transaction });
  });
});

describe('RecurrenceService.updateRecurrence', () => {
  it('rejects a count below the expenses already in the past', async () => {
    const { service } = setup();

    await expect(service.updateRecurrence({ id: 'r1', count: 1 })).rejects.toThrow('count must be at least 2');
  });

  it('appends expenses after the last one', async () => {
    const { service, expensesService } = setup();

    await service.updateRecurrence({ id: 'r1', count: 7 });

    const [, dates] = expensesService.planSeries.mock.calls[0];
    expect(dates.map(iso)).toEqual(['2026-09-15', '2026-10-15']);
    expect(expensesService.createSeriesExpenses).toHaveBeenCalledWith(
      expect.objectContaining({ concept: 'Rent', total: 100 }),
      expect.any(Array),
      { recurrenceId: 'r1', firstIndex: 5 },
      transaction
    );
  });

  it('removes the last upcoming expenses when shortened', async () => {
    const { service, expenseRepository } = setup();

    await service.updateRecurrence({ id: 'r1', count: 3 });

    expect(expenseRepository.deleteExpenses).toHaveBeenCalledWith(['e3', 'e4'], { transaction });
  });

  it('re-dates only upcoming expenses when the frequency changes', async () => {
    const { service, recurrenceRepository, expensesService } = setup();

    await service.updateRecurrence({ id: 'r1', frequency: FixedExpenseFrequency.BIWEEKLY });

    expect(recurrenceRepository.updateFrequency).toHaveBeenCalledWith('r1', FixedExpenseFrequency.BIWEEKLY, { transaction });
    expect(updatedDates(expensesService.planUpdate)).toEqual({
      e3: '2026-06-28',
      e4: '2026-07-11',
    });
  });

  it('keeps a past expense that is not at the start of the series when shortened', async () => {
    const { service, expenseRepository } = setup(
      seriesOf(['2026-04-15', '2026-05-15', '2026-06-15', '2026-06-05', '2026-08-15'])
    );

    await service.updateRecurrence({ id: 'r1', count: 3 });

    expect(expenseRepository.deleteExpenses).toHaveBeenCalledWith(['e2', 'e4'], { transaction });
  });

  it('never re-dates a past expense when the frequency changes', async () => {
    const { service, expensesService } = setup(
      seriesOf(['2026-04-15', '2026-05-15', '2026-06-15', '2026-06-05', '2026-08-15'])
    );

    await service.updateRecurrence({ id: 'r1', frequency: FixedExpenseFrequency.BIWEEKLY });

    expect(updatedDates(expensesService.planUpdate)).toEqual({ e4: '2026-06-28' });
  });
});

describe('RecurrenceService concurrency', () => {
  it('locks the series before deleting and reads it inside the transaction', async () => {
    const { service, expenseRepository, recurrenceRepository } = setup();

    await service.deleteExpense('e3', RecurrenceScope.FOLLOWING);

    expect(recurrenceRepository.findById).toHaveBeenCalledWith('r1', { transaction, lock: true });
    expect(expenseRepository.getSeriesStates).toHaveBeenCalledWith('r1', { transaction });
  });

  const conflict = { extensions: { code: 'CONFLICT' } };

  it('rejects a scoped edit when an expense of the series changed after it was planned', async () => {
    const { service, expenseRepository, expensesService } = setup();
    expenseRepository.getSeriesStates
      .mockResolvedValueOnce(monthly)
      .mockResolvedValueOnce(monthly.map((expense) =>
        expense.id === 'e3' ? { ...expense, updatedAt: new Date(2) } : expense
      ));

    await expect(
      service.updateExpense('e2', { payBefore: day('2026-06-17') }, RecurrenceScope.FOLLOWING)
    ).rejects.toMatchObject(conflict);
    expect(expensesService.applyUpdate).not.toHaveBeenCalled();
  });

  it('rejects a series update when the frequency changed after it was planned', async () => {
    const { service, recurrenceRepository, expenseRepository, expensesService } = setup();
    recurrenceRepository.findById
      .mockResolvedValueOnce({ id: 'r1', frequency: FixedExpenseFrequency.MONTHLY })
      .mockResolvedValueOnce({ id: 'r1', frequency: FixedExpenseFrequency.BIWEEKLY });

    await expect(service.updateRecurrence({ id: 'r1', count: 7 })).rejects.toMatchObject(conflict);
    expect(expenseRepository.deleteExpenses).not.toHaveBeenCalled();
    expect(expensesService.createSeriesExpenses).not.toHaveBeenCalled();
  });

  it('rejects a delete when the series no longer exists', async () => {
    const { service, recurrenceRepository, expenseRepository } = setup();
    recurrenceRepository.findById.mockResolvedValueOnce(null);

    await expect(service.deleteExpense('e3', RecurrenceScope.FOLLOWING)).rejects.toMatchObject(conflict);
    expect(expenseRepository.deleteExpenses).not.toHaveBeenCalled();
  });

  it('plans every update before opening the transaction', async () => {
    const { service, sequelize, expensesService } = setup();
    expensesService.planUpdate.mockImplementation((id, input) => {
      expect(sequelize.transaction).not.toHaveBeenCalled();
      return { id, payBefore: input.payBefore, fields: input };
    });

    await service.updateExpense('e2', { payBefore: day('2026-06-17') }, RecurrenceScope.FOLLOWING);

    expect(expensesService.planUpdate).toHaveBeenCalledTimes(3);
    expect(sequelize.transaction).toHaveBeenCalledTimes(1);
  });
});
