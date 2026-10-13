import { Sequelize } from 'sequelize';
import { ExpenseRepository } from '../../../src/repository/expense-repository.js';

describe('ExpenseRepository.getGroupedExpenses SQL', () => {
  it('filters goal spending NULL-safely in the raw query', async () => {
    const query = vi.fn().mockResolvedValue([]);
    const repo = new ExpenseRepository('user-1', { query } as unknown as Sequelize);

    await repo.getGroupedExpenses('period-1');

    const sql = query.mock.calls[0][0] as string;
    expect(sql).toContain('e.goal_role IS DISTINCT FROM \'SPENDING\'');
    expect(sql).toContain('e.user_id = :userId');
  });
});
