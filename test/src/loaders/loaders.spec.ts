import { describe, it, expect, vi } from 'vitest';
import { Sequelize } from 'sequelize';
import { createLoaders } from '../../../src/loaders/index.js';
import { GoalRepository } from '../../../src/repository/goal-repository.js';
import { ExpenseDTO } from '../../../src/dto/expense-dto.js';

const exp = (id: string, goalId: string) => ({ id, goalId }) as ExpenseDTO;

describe('createLoaders', () => {
  it('batches goalExpenses loads of the same tick into one repository call', async () => {
    const spy = vi
      .spyOn(GoalRepository.prototype, 'getExpensesByGoalIds')
      .mockResolvedValue([exp('e1', 'b'), exp('e2', 'a'), exp('e3', 'b')]);
    const loaders = createLoaders(
      'user',
      new Sequelize('sqlite::memory:', { logging: false })
    );

    const [a, b, c] = await Promise.all([
      loaders.goalExpenses.load('a'),
      loaders.goalExpenses.load('b'),
      loaders.goalExpenses.load('c'),
    ]);

    expect(spy).toHaveBeenCalledTimes(1);
    expect(spy).toHaveBeenCalledWith(['a', 'b', 'c']);
    expect(a.map((e) => e.id)).toEqual(['e2']);
    expect(b.map((e) => e.id)).toEqual(['e1', 'e3']);
    expect(c).toEqual([]);
    spy.mockRestore();
  });
});
