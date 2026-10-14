import { describe, it, expect, beforeEach, vi } from 'vitest';
import { Sequelize } from 'sequelize';
import { ExpensesService } from '../../../src/service/expenses-service.js';
import { CurrencyCode, FixedExpenseFrequency, GoalRole } from '../../../src/generated/graphql.js';

const userId = 'test-user';
let service: ExpensesService;

const mockTransaction = {
  commit: vi.fn(),
  rollback: vi.fn(),
};

const mockSequelize = {
  transaction: vi.fn().mockResolvedValue(mockTransaction),
} as unknown as Sequelize;

const basePeriod = {
  id: 'period-1',
  userId,
  startDate: '2026-04-01',
  endDate: '2026-04-14',
};

const baseFixedInput = {
  concept: 'Rent',
  total: 5000,
  payBefore: new Date('2026-04-01T00:00:00Z'),
  categoryId: 'cat-1',
  subCategoryId: 'sub-1',
  numberOfRepetitions: 3,
  frequency: FixedExpenseFrequency.MONTHLY,
};

beforeEach(() => {
  vi.clearAllMocks();
  service = new ExpensesService(userId, mockSequelize);
  Object.assign(service, {
    userSettingsService: {
      getDefaultCurrency: vi.fn().mockResolvedValue(CurrencyCode.USD),
    },
    incomeRepository: { getCurrencyByPeriod: vi.fn().mockResolvedValue(null) },
  });
});

describe('createFixedExpenses', () => {
  it('creates the correct number of monthly expenses', async () => {
    const mockGetPeriodBy = vi.fn().mockResolvedValue(basePeriod);
    const mockCreateExpense = vi.fn().mockImplementation((input) => ({
      id: crypto.randomUUID(),
      ...input,
      userId,
      card: null,
      category: { id: input.categoryId, name: 'Test', subCategories: [{ id: input.subCategoryId, name: 'Sub' }] },
      createdAt: new Date(),
      updatedAt: new Date(),
    }));

    (service as any).periodRepository = {
      getPeriodBy: mockGetPeriodBy,
      createPeriod: vi.fn(),
    };
    (service as any).expenseRepository = {
      createExpense: mockCreateExpense,
    };

    const result = await service.createFixedExpenses(baseFixedInput);

    expect(result).toHaveLength(3);
    expect(mockCreateExpense).toHaveBeenCalledTimes(3);
    expect(mockTransaction.commit).toHaveBeenCalled();
    expect(mockTransaction.rollback).not.toHaveBeenCalled();
  });

  it('creates biweekly expenses with 15-day intervals', async () => {
    const mockGetPeriodBy = vi.fn().mockResolvedValue(basePeriod);
    const mockCreateExpense = vi.fn().mockImplementation((input) => ({
      id: crypto.randomUUID(),
      ...input,
      userId,
      card: null,
      category: { id: input.categoryId, name: 'Test', subCategories: [{ id: input.subCategoryId, name: 'Sub' }] },
      createdAt: new Date(),
      updatedAt: new Date(),
    }));

    (service as any).periodRepository = {
      getPeriodBy: mockGetPeriodBy,
      createPeriod: vi.fn(),
    };
    (service as any).expenseRepository = {
      createExpense: mockCreateExpense,
    };

    await service.createFixedExpenses({
      ...baseFixedInput,
      frequency: FixedExpenseFrequency.BIWEEKLY,
    });

    const payBeforeDates = mockCreateExpense.mock.calls.map(
      (call) => call[0].payBefore
    );
    expect(payBeforeDates[0].toISOString()).toBe('2026-04-01T00:00:00.000Z');
    expect(payBeforeDates[1].toISOString()).toBe('2026-04-14T00:00:00.000Z');
    expect(payBeforeDates[2].toISOString()).toBe('2026-04-27T00:00:00.000Z');
  });

  it('creates monthly expenses advancing by month', async () => {
    const mockGetPeriodBy = vi.fn().mockResolvedValue(basePeriod);
    const mockCreateExpense = vi.fn().mockImplementation((input) => ({
      id: crypto.randomUUID(),
      ...input,
      userId,
      card: null,
      category: { id: input.categoryId, name: 'Test', subCategories: [{ id: input.subCategoryId, name: 'Sub' }] },
      createdAt: new Date(),
      updatedAt: new Date(),
    }));

    (service as any).periodRepository = {
      getPeriodBy: mockGetPeriodBy,
      createPeriod: vi.fn(),
    };
    (service as any).expenseRepository = {
      createExpense: mockCreateExpense,
    };

    await service.createFixedExpenses(baseFixedInput);

    const payBeforeDates = mockCreateExpense.mock.calls.map(
      (call) => call[0].payBefore
    );
    expect(payBeforeDates[0].toISOString()).toBe('2026-04-01T00:00:00.000Z');
    expect(payBeforeDates[1].toISOString()).toBe('2026-05-01T00:00:00.000Z');
    expect(payBeforeDates[2].toISOString()).toBe('2026-06-01T00:00:00.000Z');
  });

  it('creates periods when none exist for a target date', async () => {
    const mockGetPeriodBy = vi.fn().mockResolvedValue(null);
    const mockCreatePeriod = vi.fn().mockResolvedValue({ id: 'new-period' });
    const mockCreateExpense = vi.fn().mockImplementation((input) => ({
      id: crypto.randomUUID(),
      ...input,
      userId,
      card: null,
      category: { id: input.categoryId, name: 'Test', subCategories: [{ id: input.subCategoryId, name: 'Sub' }] },
      createdAt: new Date(),
      updatedAt: new Date(),
    }));

    (service as any).periodRepository = {
      getPeriodBy: mockGetPeriodBy,
      createPeriod: mockCreatePeriod,
    };
    (service as any).expenseRepository = {
      createExpense: mockCreateExpense,
    };

    await service.createFixedExpenses({
      ...baseFixedInput,
      numberOfRepetitions: 2,
    });

    expect(mockCreatePeriod).toHaveBeenCalledTimes(2);
    expect(mockCreateExpense).toHaveBeenCalledTimes(2);

    const periodIds = mockCreateExpense.mock.calls.map(
      (call) => call[0].periodId
    );
    expect(periodIds).toEqual(['new-period', 'new-period']);
  });

  it('rolls back on error', async () => {
    const mockGetPeriodBy = vi.fn().mockResolvedValue(basePeriod);
    const mockCreateExpense = vi
      .fn()
      .mockRejectedValue(new Error('DB error'));

    (service as any).periodRepository = {
      getPeriodBy: mockGetPeriodBy,
      createPeriod: vi.fn(),
    };
    (service as any).expenseRepository = {
      createExpense: mockCreateExpense,
    };

    await expect(
      service.createFixedExpenses(baseFixedInput)
    ).rejects.toThrow('DB error');

    expect(mockTransaction.rollback).toHaveBeenCalled();
    expect(mockTransaction.commit).not.toHaveBeenCalled();
  });

  it('passes cardId when provided', async () => {
    const mockGetPeriodBy = vi.fn().mockResolvedValue(basePeriod);
    const mockCreateExpense = vi.fn().mockImplementation((input) => ({
      id: crypto.randomUUID(),
      ...input,
      userId,
      card: { id: input.cardId },
      category: { id: input.categoryId, name: 'Test', subCategories: [{ id: input.subCategoryId, name: 'Sub' }] },
      createdAt: new Date(),
      updatedAt: new Date(),
    }));

    (service as any).periodRepository = {
      getPeriodBy: mockGetPeriodBy,
      createPeriod: vi.fn(),
    };
    (service as any).expenseRepository = {
      createExpense: mockCreateExpense,
    };

    await service.createFixedExpenses({
      ...baseFixedInput,
      numberOfRepetitions: 1,
      cardId: 'card-123',
    });

    expect(mockCreateExpense.mock.calls[0][0].cardId).toBe('card-123');
  });
});

describe('goal link on expenses', () => {
  const goalId = 'goal-1';
  const baseCreateInput = {
    concept: 'Flights',
    total: 100,
    periodId: 'period-1',
    payBefore: new Date('2026-04-02T00:00:00Z'),
    categoryId: 'cat-1',
    subCategoryId: 'sub-1',
  };
  const withoutPeriod = (input: typeof baseCreateInput) => {
    const rest: Partial<typeof baseCreateInput> = { ...input };
    delete rest.periodId;
    return rest as Omit<typeof baseCreateInput, 'periodId'>;
  };
  const echo = (input: object) => ({ id: 'e-1', ...input });

  let mockCreateExpense: ReturnType<typeof vi.fn>;
  let mockUpdateExpense: ReturnType<typeof vi.fn>;
  let mockAssertGoalLinkable: ReturnType<typeof vi.fn>;
  let mockGetPeriodBy: ReturnType<typeof vi.fn>;
  let mockCreatePeriod: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    mockCreateExpense = vi.fn().mockImplementation(echo);
    mockUpdateExpense = vi.fn().mockImplementation((_id: string, input: object) => echo(input));
    mockAssertGoalLinkable = vi.fn().mockResolvedValue({ id: goalId });
    mockGetPeriodBy = vi.fn().mockResolvedValue(basePeriod);
    mockCreatePeriod = vi.fn().mockResolvedValue({ id: 'new-period' });
    const internals = service as unknown as Record<string, unknown>;
    internals.expenseRepository = {
      createExpense: mockCreateExpense,
      updateExpense: mockUpdateExpense,
      getPeriodId: vi.fn().mockResolvedValue(null),
    };
    internals.periodRepository = {
      getPeriodBy: mockGetPeriodBy,
      createPeriod: mockCreatePeriod,
    };
    internals.goalService = {
      assertGoalLinkable: mockAssertGoalLinkable,
    };
  });

  const goalNotFound = () =>
    Object.assign(new Error('Goal not found'), {
      extensions: { code: 'GOAL_NOT_FOUND' },
    });

  describe('createExpense', () => {
    it('rejects goalId without goalRole', async () => {
      await expect(
        service.createExpense({ ...baseCreateInput, goalId })
      ).rejects.toMatchObject({
        extensions: { code: 'VALIDATION_ERROR', argumentName: 'goalRole' },
      });
      expect(mockCreateExpense).not.toHaveBeenCalled();
    });

    it('rejects goalRole without goalId', async () => {
      await expect(
        service.createExpense({ ...baseCreateInput, goalRole: GoalRole.SPENDING })
      ).rejects.toMatchObject({
        extensions: { code: 'VALIDATION_ERROR', argumentName: 'goalId' },
      });
      expect(mockCreateExpense).not.toHaveBeenCalled();
    });

    it('creates nothing when the goal is not found', async () => {
      mockAssertGoalLinkable.mockRejectedValue(goalNotFound());
      await expect(
        service.createExpense({
          ...baseCreateInput,
          goalId,
          goalRole: GoalRole.CONTRIBUTION,
        })
      ).rejects.toMatchObject({ extensions: { code: 'GOAL_NOT_FOUND' } });
      expect(mockCreateExpense).not.toHaveBeenCalled();
    });

    it('links a CONTRIBUTION expense and keeps the client periodId', async () => {
      await service.createExpense({
        ...baseCreateInput,
        goalId,
        goalRole: GoalRole.CONTRIBUTION,
      });
      expect(mockAssertGoalLinkable).toHaveBeenCalledWith(goalId);
      expect(mockCreateExpense.mock.calls[0][0]).toMatchObject({
        goalId,
        goalRole: GoalRole.CONTRIBUTION,
        periodId: 'period-1',
      });
    });

    it('does not touch goals for an unlinked expense', async () => {
      await service.createExpense(baseCreateInput);
      expect(mockAssertGoalLinkable).not.toHaveBeenCalled();
      expect(mockCreateExpense).toHaveBeenCalledTimes(1);
    });

    it('assigns the period of payBefore to a SPENDING expense without periodId', async () => {
      const noPeriod = withoutPeriod(baseCreateInput);
      await service.createExpense({ ...noPeriod, goalId, goalRole: GoalRole.SPENDING });
      expect(mockGetPeriodBy.mock.calls[0][0]).toEqual({
        date: baseCreateInput.payBefore,
      });
      expect(mockCreatePeriod).not.toHaveBeenCalled();
      expect(mockCreateExpense.mock.calls[0][0].periodId).toBe('period-1');
    });

    it('creates the period when none exists for a SPENDING expense', async () => {
      mockGetPeriodBy.mockResolvedValue(null);
      const noPeriod = withoutPeriod(baseCreateInput);
      await service.createExpense({ ...noPeriod, goalId, goalRole: GoalRole.SPENDING });
      expect(mockCreatePeriod).toHaveBeenCalledTimes(1);
      expect(mockCreateExpense.mock.calls[0][0].periodId).toBe('new-period');
    });

    it('creates no period when the create is rejected by validation', async () => {
      mockGetPeriodBy.mockResolvedValue(null);
      const noPeriod = withoutPeriod(baseCreateInput);
      await expect(
        service.createExpense({
          ...noPeriod,
          concept: '',
          goalId,
          goalRole: GoalRole.SPENDING,
        })
      ).rejects.toThrow('Concept must not be empty');
      expect(mockCreatePeriod).not.toHaveBeenCalled();
      expect(mockSequelize.transaction).not.toHaveBeenCalled();
    });

    it('creates the SPENDING period and expense in one transaction and rolls back together', async () => {
      mockGetPeriodBy.mockResolvedValue(null);
      const noPeriod = withoutPeriod(baseCreateInput);
      await service.createExpense({
        ...noPeriod,
        goalId,
        goalRole: GoalRole.SPENDING,
      });
      expect(mockTransaction.commit).toHaveBeenCalled();
      expect(mockCreateExpense.mock.calls[0][1]).toEqual({
        transaction: mockTransaction,
      });

      mockCreateExpense.mockRejectedValueOnce(new Error('DB error'));
      await expect(
        service.createExpense({
          ...noPeriod,
          goalId,
          goalRole: GoalRole.SPENDING,
        })
      ).rejects.toThrow('DB error');
      expect(mockTransaction.rollback).toHaveBeenCalledTimes(1);
    });

    it('still requires periodId for unlinked and CONTRIBUTION expenses', async () => {
      const noPeriod = withoutPeriod(baseCreateInput);
      await expect(service.createExpense(noPeriod)).rejects.toMatchObject({
        extensions: { code: 'VALIDATION_ERROR', argumentName: 'periodId' },
      });
      await expect(
        service.createExpense({ ...noPeriod, goalId, goalRole: GoalRole.CONTRIBUTION })
      ).rejects.toMatchObject({
        extensions: { code: 'VALIDATION_ERROR', argumentName: 'periodId' },
      });
      expect(mockCreateExpense).not.toHaveBeenCalled();
    });

    it('allows a date outside the goal range (service never compares dates)', async () => {
      await service.createExpense({
        ...baseCreateInput,
        payBefore: new Date('1999-01-01T00:00:00Z'),
        goalId,
        goalRole: GoalRole.CONTRIBUTION,
      });
      expect(mockCreateExpense).toHaveBeenCalledTimes(1);
    });
  });

  describe('createFixedExpenses', () => {
    it('rejects a half-set link and creates nothing', async () => {
      await expect(
        service.createFixedExpenses({ ...baseFixedInput, goalRole: GoalRole.SPENDING })
      ).rejects.toMatchObject({
        extensions: { code: 'VALIDATION_ERROR', argumentName: 'goalId' },
      });
      expect(mockCreateExpense).not.toHaveBeenCalled();
      expect(mockSequelize.transaction).not.toHaveBeenCalled();
    });

    it('creates nothing when the goal is not found', async () => {
      mockAssertGoalLinkable.mockRejectedValue(goalNotFound());
      await expect(
        service.createFixedExpenses({
          ...baseFixedInput,
          goalId,
          goalRole: GoalRole.CONTRIBUTION,
        })
      ).rejects.toMatchObject({ extensions: { code: 'GOAL_NOT_FOUND' } });
      expect(mockCreateExpense).not.toHaveBeenCalled();
    });

    it('links every copy to the same goal and role', async () => {
      const result = await service.createFixedExpenses({
        ...baseFixedInput,
        goalId,
        goalRole: GoalRole.CONTRIBUTION,
      });
      expect(result).toHaveLength(3);
      expect(mockAssertGoalLinkable).toHaveBeenCalledTimes(1);
      mockCreateExpense.mock.calls.forEach(([created]) => {
        expect(created).toMatchObject({ goalId, goalRole: GoalRole.CONTRIBUTION });
      });
    });

    it('leaves copies unlinked when no goal is given', async () => {
      await service.createFixedExpenses(baseFixedInput);
      mockCreateExpense.mock.calls.forEach(([created]) => {
        expect(created.goalId).toBeNull();
        expect(created.goalRole).toBeNull();
      });
    });
  });

  describe('updateExpense', () => {
    const baseUpdate = {
      concept: 'Flights',
      total: 100,
      payBefore: new Date('2026-04-02T00:00:00Z'),
      subCategoryId: 'sub-1',
    };

    it('leaves the link untouched when the keys are omitted', async () => {
      await service.updateExpense('e-1', baseUpdate);
      const sent = mockUpdateExpense.mock.calls[0][1];
      expect('goalId' in sent).toBe(false);
      expect('goalRole' in sent).toBe(false);
      expect(mockAssertGoalLinkable).not.toHaveBeenCalled();
    });

    it('unlinks when both are null', async () => {
      await service.updateExpense('e-1', {
        ...baseUpdate,
        goalId: null,
        goalRole: null,
      });
      const sent = mockUpdateExpense.mock.calls[0][1];
      expect(sent.goalId).toBeNull();
      expect(sent.goalRole).toBeNull();
      expect(mockAssertGoalLinkable).not.toHaveBeenCalled();
    });

    it('relinks when both are set', async () => {
      await service.updateExpense('e-1', {
        ...baseUpdate,
        goalId,
        goalRole: GoalRole.SPENDING,
      });
      expect(mockAssertGoalLinkable).toHaveBeenCalledWith(goalId);
      expect(mockUpdateExpense.mock.calls[0][1]).toMatchObject({
        goalId,
        goalRole: GoalRole.SPENDING,
      });
    });

    it('rejects sending only one of the two keys', async () => {
      await expect(
        service.updateExpense('e-1', { ...baseUpdate, goalId })
      ).rejects.toMatchObject({
        extensions: { code: 'VALIDATION_ERROR', argumentName: 'goalRole' },
      });
      await expect(
        service.updateExpense('e-1', { ...baseUpdate, goalRole: null })
      ).rejects.toMatchObject({
        extensions: { code: 'VALIDATION_ERROR', argumentName: 'goalId' },
      });
      expect(mockUpdateExpense).not.toHaveBeenCalled();
    });

    it('rejects a mixed null and value pair', async () => {
      await expect(
        service.updateExpense('e-1', {
          ...baseUpdate,
          goalId: null,
          goalRole: GoalRole.SPENDING,
        })
      ).rejects.toMatchObject({
        extensions: { code: 'VALIDATION_ERROR', argumentName: 'goalId' },
      });
      expect(mockUpdateExpense).not.toHaveBeenCalled();
    });

    it('updates nothing when the goal is not found, before opening a transaction', async () => {
      mockAssertGoalLinkable.mockRejectedValue(goalNotFound());
      await expect(
        service.updateExpense('e-1', {
          ...baseUpdate,
          goalId,
          goalRole: GoalRole.CONTRIBUTION,
        })
      ).rejects.toMatchObject({ extensions: { code: 'GOAL_NOT_FOUND' } });
      expect(mockUpdateExpense).not.toHaveBeenCalled();
      expect(mockSequelize.transaction).not.toHaveBeenCalled();
    });

    it('creates the period when the new date has none instead of crashing', async () => {
      mockGetPeriodBy.mockResolvedValue(null);
      await service.updateExpense('e-1', baseUpdate);
      expect(mockCreatePeriod).toHaveBeenCalledTimes(1);
      expect(mockUpdateExpense.mock.calls[0][1].periodId).toBe('new-period');
    });
  });
});
