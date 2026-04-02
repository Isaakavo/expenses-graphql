import { describe, it, expect, beforeEach, vi } from 'vitest';
import { Sequelize } from 'sequelize';
import { ExpensesService } from '../../../src/service/expenses-service.js';
import { FixedExpenseFrequency } from '../../../src/generated/graphql.js';

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
