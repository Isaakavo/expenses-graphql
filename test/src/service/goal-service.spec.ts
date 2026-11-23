import { describe, it, expect, beforeEach, vi } from 'vitest';
import { Sequelize } from 'sequelize';
import { GoalService } from '../../../src/service/goal-service.js';
import { ExpenseDTO } from '../../../src/dto/expense-dto.js';
import { CurrencyCode, GoalKind } from '../../../src/generated/graphql.js';
import { GoalRepository } from '../../../src/repository/goal-repository.js';
import { SavingsFundRepository } from '../../../src/repository/savings-fund-repository.js';

const userId = 'test-user';
let service: GoalService;
let mockRepo: GoalRepository;
let mockFunds: SavingsFundRepository;

const fund = { id: 'fund-1', name: 'Ahorros', currency: CurrencyCode.MXN };

const goalDto = {
  id: 'goal-1',
  userId,
  name: 'Trip',
  kind: GoalKind.SAVINGS,
  targetAmount: 1000,
  currency: CurrencyCode.USD,
  startDate: '2026-01-01',
  endDate: null,
  fund: null,
  defaultCard: null,
};

const validInput = {
  name: 'Trip',
  targetAmount: 1000,
  startDate: '2026-01-01',
  endDate: '2026-06-01',
};

const expectCode = async (
  promise: Promise<unknown>,
  code: string,
  argumentName?: string
) => {
  await expect(promise).rejects.toMatchObject({
    extensions: argumentName ? { code, argumentName } : { code },
  });
};

beforeEach(() => {
  mockRepo = {
    getGoals: vi.fn(),
    getGoalByPk: vi.fn(),
    createGoal: vi.fn(),
    updateGoal: vi.fn(),
    closeGoal: vi.fn(),
    deleteGoal: vi.fn(),
    getExpensesByGoalIds: vi.fn(),
    cardExists: vi.fn().mockResolvedValue(true),
    countExpenses: vi.fn().mockResolvedValue(0),
    countReimbursements: vi.fn().mockResolvedValue(0),
    getReimbursementsByGoalIds: vi.fn(),
    addReimbursement: vi.fn(),
    updateReimbursement: vi.fn(),
    deleteReimbursement: vi.fn(),
  } as unknown as GoalRepository;
  mockFunds = {
    getFunds: vi.fn().mockResolvedValue([fund]),
    getFundByPk: vi.fn().mockResolvedValue(fund),
    getOrCreateFirstFund: vi.fn().mockResolvedValue(fund),
  } as unknown as SavingsFundRepository;
  service = new GoalService(
    userId,
    new Sequelize('sqlite::memory:', { logging: false })
  );
  service.goalRepository = mockRepo;
  service.savingsFundRepository = mockFunds;
  Object.assign(service, {
    userSettingsService: { getDefaultCurrency: vi.fn().mockResolvedValue(CurrencyCode.USD) },
  });
});

describe('GoalService', () => {
  describe('createGoal validation', () => {
    it('rejects an empty or whitespace name', async () => {
      await expectCode(
        service.createGoal({ ...validInput, name: '   ' }),
        'VALIDATION_ERROR',
        'name'
      );
    });

    it('rejects a name longer than 100 characters', async () => {
      await expectCode(
        service.createGoal({ ...validInput, name: 'a'.repeat(101) }),
        'VALIDATION_ERROR',
        'name'
      );
    });

    it.each([0, -5, NaN, Infinity, 10000000000])(
      'rejects targetAmount %s',
      async (targetAmount) => {
        await expectCode(
          service.createGoal({ ...validInput, targetAmount }),
          'VALIDATION_ERROR',
          'targetAmount'
        );
      }
    );

    it('rejects endDate before startDate', async () => {
      await expectCode(
        service.createGoal({
          ...validInput,
          endDate: '2025-12-31',
        }),
        'VALIDATION_ERROR',
        'endDate'
      );
    });

    it.each(['2026/01/01', '01-01-2026', '2026-1-1', 'garbage', ''])(
      'rejects malformed startDate %j',
      async (startDate) => {
        await expectCode(
          service.createGoal({ ...validInput, startDate }),
          'VALIDATION_ERROR',
          'startDate'
        );
      }
    );

    it('rejects non-existent calendar days', async () => {
      await expectCode(
        service.createGoal({ ...validInput, startDate: '2026-02-30' }),
        'VALIDATION_ERROR',
        'startDate'
      );
      await expectCode(
        service.createGoal({ ...validInput, endDate: '2026-13-01' }),
        'VALIDATION_ERROR',
        'endDate'
      );
    });

    it('trims the name, normalizes dates and calls the repository', async () => {
      vi.mocked(mockRepo.createGoal).mockResolvedValue(goalDto);
      const result = await service.createGoal({
        ...validInput,
        name: '  Trip  ',
        targetAmount: 9999999999.99,
      });
      expect(mockRepo.createGoal).toHaveBeenCalledWith({
        name: 'Trip',
        targetAmount: 9999999999.99,
        startDate: '2026-01-01',
        endDate: '2026-06-01',
        currency: CurrencyCode.USD,
        kind: GoalKind.SAVINGS,
        fundId: null,
        defaultCardId: null,
      });
      expect(result).toEqual(goalDto);
    });

    it('allows a goal without endDate and endDate equal to startDate', async () => {
      vi.mocked(mockRepo.createGoal).mockResolvedValue(goalDto);
      await service.createGoal({ ...validInput, endDate: null });
      await service.createGoal({
        ...validInput,
        endDate: '2026-01-01',
      });
      expect(mockRepo.createGoal).toHaveBeenCalledTimes(2);
    });
  });

  describe('updateGoal', () => {
    it('throws GOAL_NOT_FOUND when the goal does not exist', async () => {
      vi.mocked(mockRepo.getGoalByPk).mockResolvedValue(null);
      await expectCode(
        service.updateGoal({ id: 'missing', ...validInput }),
        'GOAL_NOT_FOUND'
      );
      expect(mockRepo.updateGoal).not.toHaveBeenCalled();
    });

    it('validates before touching the repository', async () => {
      vi.mocked(mockRepo.getGoalByPk).mockResolvedValue(goalDto);
      await expectCode(
        service.updateGoal({ id: 'goal-1', ...validInput, name: '' }),
        'VALIDATION_ERROR',
        'name'
      );
      expect(mockRepo.updateGoal).not.toHaveBeenCalled();
    });

    it('rejects endDate before startDate and malformed dates', async () => {
      vi.mocked(mockRepo.getGoalByPk).mockResolvedValue(goalDto);
      await expectCode(
        service.updateGoal({
          id: 'goal-1',
          ...validInput,
          endDate: '2025-12-31',
        }),
        'VALIDATION_ERROR',
        'endDate'
      );
      await expectCode(
        service.updateGoal({ id: 'goal-1', ...validInput, startDate: 'x' }),
        'VALIDATION_ERROR',
        'startDate'
      );
    });

    it('checks the goal is linkable before updating', async () => {
      const order: string[] = [];
      vi.mocked(mockRepo.getGoalByPk).mockImplementation(async () => {
        order.push('assert');
        return goalDto;
      });
      vi.mocked(mockRepo.updateGoal).mockImplementation(async () => {
        order.push('update');
        return goalDto;
      });
      await service.updateGoal({ id: 'goal-1', ...validInput });
      expect(order).toEqual(['assert', 'update']);
    });

    it('updates an existing goal', async () => {
      vi.mocked(mockRepo.getGoalByPk).mockResolvedValue(goalDto);
      vi.mocked(mockRepo.updateGoal).mockResolvedValue(goalDto);
      await service.updateGoal({ id: 'goal-1', ...validInput });
      expect(mockRepo.updateGoal).toHaveBeenCalledWith('goal-1', {
        name: 'Trip',
        targetAmount: 1000,
        startDate: '2026-01-01',
        endDate: '2026-06-01',
      });
    });
  });

  describe('closeGoal', () => {
    it('throws GOAL_NOT_FOUND when the goal does not exist', async () => {
      vi.mocked(mockRepo.getGoalByPk).mockResolvedValue(null);
      await expectCode(
        service.closeGoal({ id: 'missing', endDate: '2026-06-01' }),
        'GOAL_NOT_FOUND'
      );
    });

    it('rejects endDate before the goal startDate', async () => {
      vi.mocked(mockRepo.getGoalByPk).mockResolvedValue(goalDto);
      await expectCode(
        service.closeGoal({ id: 'goal-1', endDate: '2025-12-31' }),
        'VALIDATION_ERROR',
        'endDate'
      );
      expect(mockRepo.closeGoal).not.toHaveBeenCalled();
    });

    it.each(['2026-02-30', 'nope'])(
      'rejects invalid endDate %j',
      async (endDate) => {
        vi.mocked(mockRepo.getGoalByPk).mockResolvedValue(goalDto);
        await expectCode(
          service.closeGoal({ id: 'goal-1', endDate }),
          'VALIDATION_ERROR',
          'endDate'
        );
        expect(mockRepo.closeGoal).not.toHaveBeenCalled();
      }
    );

    it('closes the goal', async () => {
      vi.mocked(mockRepo.getGoalByPk).mockResolvedValue(goalDto);
      vi.mocked(mockRepo.closeGoal).mockResolvedValue({
        ...goalDto,
        endDate: '2026-06-01',
      });
      const result = await service.closeGoal({
        id: 'goal-1',
        endDate: '2026-06-01',
      });
      expect(mockRepo.closeGoal).toHaveBeenCalledWith('goal-1', '2026-06-01');
      expect(result.endDate).toBe('2026-06-01');
    });
  });

  describe('deleteGoal', () => {
    it('throws GOAL_NOT_FOUND when the goal does not exist', async () => {
      vi.mocked(mockRepo.getGoalByPk).mockResolvedValue(null);
      await expectCode(service.deleteGoal('missing'), 'GOAL_NOT_FOUND');
      expect(mockRepo.deleteGoal).not.toHaveBeenCalled();
    });

    it('calls the repository to delete', async () => {
      vi.mocked(mockRepo.getGoalByPk).mockResolvedValue(goalDto);
      vi.mocked(mockRepo.deleteGoal).mockResolvedValue(true);
      await expect(service.deleteGoal('goal-1')).resolves.toBe(true);
      expect(mockRepo.deleteGoal).toHaveBeenCalledWith('goal-1');
    });
  });

  describe('assertGoalLinkable', () => {
    it('throws GOAL_NOT_FOUND for unknown or foreign goals', async () => {
      vi.mocked(mockRepo.getGoalByPk).mockResolvedValue(null);
      await expectCode(service.assertGoalLinkable('x'), 'GOAL_NOT_FOUND');
    });

    it('returns the goal when it exists', async () => {
      vi.mocked(mockRepo.getGoalByPk).mockResolvedValue(goalDto);
      await expect(service.assertGoalLinkable('goal-1')).resolves.toEqual(
        goalDto
      );
    });
  });

  describe('getExpensesGroupedByGoalIds', () => {
    const exp = (id: string, goalId: string) => ({ id, goalId }) as ExpenseDTO;

    it('groups per key in input order, [] for missing, keeps repo order', async () => {
      vi.mocked(mockRepo.getExpensesByGoalIds).mockResolvedValue([
        exp('e1', 'b'),
        exp('e2', 'a'),
        exp('e3', 'b'),
      ]);

      const result = await service.getExpensesGroupedByGoalIds(['a', 'c', 'b']);

      expect(result.map((l) => l.map((e) => e.id))).toEqual([
        ['e2'],
        [],
        ['e1', 'e3'],
      ]);
    });
  });

  describe('reimbursable goals', () => {
    const event = {
      ...goalDto,
      id: 'event-1',
      kind: GoalKind.REIMBURSABLE,
      targetAmount: null,
      fund,
    };
    const eventInput = {
      name: 'Viaje CDMX',
      kind: GoalKind.REIMBURSABLE,
      startDate: '2026-11-25',
    };

    it('creates an event in the default fund without a target', async () => {
      vi.mocked(mockRepo.createGoal).mockResolvedValue(event);
      await service.createGoal({ ...eventInput, defaultCardId: 'card-1' });
      expect(mockRepo.createGoal).toHaveBeenCalledWith({
        name: 'Viaje CDMX',
        kind: GoalKind.REIMBURSABLE,
        targetAmount: null,
        startDate: '2026-11-25',
        endDate: null,
        fundId: 'fund-1',
        defaultCardId: 'card-1',
        currency: CurrencyCode.USD,
      });
    });

    it('creates the default fund on first use in the default currency', async () => {
      await expect(service.getDefaultFund()).resolves.toEqual(fund);
      const [name, currency] = vi.mocked(mockFunds.getOrCreateFirstFund).mock.calls[0];
      expect(name).toBe('Ahorros');
      await expect(currency()).resolves.toBe(CurrencyCode.USD);
    });

    it('lists funds without creating one', async () => {
      vi.mocked(mockFunds.getFunds).mockResolvedValue([]);
      await expect(service.getSavingsFunds()).resolves.toEqual([]);
      expect(mockFunds.getOrCreateFirstFund).not.toHaveBeenCalled();
    });

    it('only accepts a default card on events', async () => {
      await expectCode(
        service.createGoal({ ...validInput, defaultCardId: 'card-1' }),
        'VALIDATION_ERROR',
        'defaultCardId'
      );
      vi.mocked(mockRepo.getGoalByPk).mockResolvedValue(goalDto);
      await expectCode(
        service.updateGoal({ id: 'goal-1', ...validInput, defaultCardId: 'card-1' }),
        'VALIDATION_ERROR',
        'defaultCardId'
      );
      expect(mockRepo.createGoal).not.toHaveBeenCalled();
      expect(mockRepo.updateGoal).not.toHaveBeenCalled();
    });

    it.each([
      ['expenses', 'countExpenses'],
      ['reimbursements', 'countReimbursements'],
    ] as const)('refuses to delete an event with %s', async (_, counter) => {
      vi.mocked(mockRepo.getGoalByPk).mockResolvedValue(event);
      vi.mocked(mockRepo[counter]).mockResolvedValue(1);
      await expectCode(service.deleteGoal('event-1'), 'REIMBURSABLE_GOAL_IN_USE');
      expect(mockRepo.deleteGoal).not.toHaveBeenCalled();
    });

    it('deletes an event without expenses or reimbursements', async () => {
      vi.mocked(mockRepo.getGoalByPk).mockResolvedValue(event);
      vi.mocked(mockRepo.deleteGoal).mockResolvedValue(true);
      await expect(service.deleteGoal('event-1')).resolves.toBe(true);
    });

    it('stores the reimbursement amount rounded to cents', async () => {
      await service.updateReimbursement({ id: 'r-1', amount: 10.005, receivedOn: '2026-12-01' });
      expect(mockRepo.updateReimbursement).toHaveBeenCalledWith(
        'r-1',
        expect.objectContaining({ amount: 10.01 })
      );
    });

    it('rejects a target on an event and a missing target on a savings goal', async () => {
      await expectCode(
        service.createGoal({ ...eventInput, targetAmount: 100 }),
        'VALIDATION_ERROR',
        'targetAmount'
      );
      await expectCode(
        service.createGoal({ ...validInput, targetAmount: null }),
        'VALIDATION_ERROR',
        'targetAmount'
      );
    });

    it('rejects a fund on a savings goal and an unknown fund on an event', async () => {
      await expectCode(
        service.createGoal({ ...validInput, fundId: 'fund-1' }),
        'VALIDATION_ERROR',
        'fundId'
      );
      vi.mocked(mockFunds.getFundByPk).mockResolvedValue(null);
      await expectCode(
        service.createGoal({ ...eventInput, fundId: 'other' }),
        'VALIDATION_ERROR',
        'fundId'
      );
      expect(mockRepo.createGoal).not.toHaveBeenCalled();
    });

    it('rejects a default card of another user', async () => {
      vi.mocked(mockRepo.cardExists).mockResolvedValue(false);
      await expectCode(
        service.createGoal({ ...eventInput, defaultCardId: 'card-x' }),
        'VALIDATION_ERROR',
        'defaultCardId'
      );
    });

    it('keeps the default card when omitted and clears it when null', async () => {
      vi.mocked(mockRepo.getGoalByPk).mockResolvedValue(event);
      vi.mocked(mockRepo.updateGoal).mockResolvedValue(event);
      await service.updateGoal({ id: 'event-1', ...eventInput });
      expect(mockRepo.updateGoal).toHaveBeenLastCalledWith(
        'event-1',
        expect.not.objectContaining({ defaultCardId: expect.anything() })
      );
      await service.updateGoal({ id: 'event-1', ...eventInput, defaultCardId: null });
      expect(mockRepo.updateGoal).toHaveBeenLastCalledWith(
        'event-1',
        expect.objectContaining({ defaultCardId: null })
      );
    });

    it('blocks a currency change once the event has reimbursements', async () => {
      vi.mocked(mockRepo.getGoalByPk).mockResolvedValue(event);
      vi.mocked(mockRepo.countReimbursements).mockResolvedValue(1);
      await expectCode(
        service.updateGoal({ id: 'event-1', ...eventInput, currency: CurrencyCode.MXN }),
        'VALIDATION_ERROR',
        'currency'
      );
      expect(mockRepo.updateGoal).not.toHaveBeenCalled();
    });

    it('adds a reimbursement with a trimmed comment', async () => {
      vi.mocked(mockRepo.getGoalByPk).mockResolvedValue(event);
      await service.addReimbursement({
        goalId: 'event-1',
        amount: 600,
        receivedOn: '2026-12-01',
        comment: '  ',
      });
      expect(mockRepo.addReimbursement).toHaveBeenCalledWith('event-1', {
        amount: 600,
        receivedOn: '2026-12-01',
        comment: null,
      });
    });

    it('only adds reimbursements to events', async () => {
      vi.mocked(mockRepo.getGoalByPk).mockResolvedValue(goalDto);
      await expectCode(
        service.addReimbursement({ goalId: 'goal-1', amount: 1, receivedOn: '2026-12-01' }),
        'VALIDATION_ERROR',
        'goalId'
      );
    });

    it.each([
      [{ amount: 0 }, 'amount'],
      [{ amount: NaN }, 'amount'],
      [{ amount: -5 }, 'amount'],
      [{ amount: 0.004 }, 'amount'],
      [{ receivedOn: '2026-02-30' }, 'receivedOn'],
      [{ comment: 'a'.repeat(256) }, 'comment'],
    ])('rejects reimbursement %j', async (override, argumentName) => {
      await expectCode(
        service.updateReimbursement({
          id: 'r-1',
          amount: 10,
          receivedOn: '2026-12-01',
          ...override,
        }),
        'VALIDATION_ERROR',
        argumentName
      );
      expect(mockRepo.updateReimbursement).not.toHaveBeenCalled();
    });

    it('groups reimbursements per goal in input order', async () => {
      vi.mocked(mockRepo.getReimbursementsByGoalIds).mockResolvedValue([
        { id: 'r1', goalId: 'b', amount: 1, receivedOn: '2026-12-01', comment: null },
        { id: 'r2', goalId: 'a', amount: 2, receivedOn: '2026-12-02', comment: null },
      ]);
      const result = await service.getReimbursementsGroupedByGoalIds(['a', 'c', 'b']);
      expect(result.map((list) => list.map((r) => r.id))).toEqual([['r2'], [], ['r1']]);
    });
  });
});
