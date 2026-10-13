import { describe, it, expect, beforeEach, vi } from 'vitest';
import { Sequelize } from 'sequelize';
import { GoalService } from '../../../src/service/goal-service.js';
import { ExpenseDTO } from '../../../src/dto/expense-dto.js';
import { GoalRepository } from '../../../src/repository/goal-repository.js';

const userId = 'test-user';
let service: GoalService;
let mockRepo: GoalRepository;

const goalDto = {
  id: 'goal-1',
  userId,
  name: 'Trip',
  targetAmount: 1000,
  startDate: '2026-01-01',
  endDate: null,
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
  } as unknown as GoalRepository;
  service = new GoalService(
    userId,
    new Sequelize('sqlite::memory:', { logging: false })
  );
  service.goalRepository = mockRepo;
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
      await expectCode(
        service.updateGoal({ id: 'goal-1', ...validInput, name: '' }),
        'VALIDATION_ERROR',
        'name'
      );
      expect(mockRepo.updateGoal).not.toHaveBeenCalled();
    });

    it('rejects endDate before startDate and malformed dates', async () => {
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
});
