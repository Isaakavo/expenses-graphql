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

  it('returns numeric totals although Postgres SUM over numeric comes back as a string', async () => {
    const query = vi.fn().mockResolvedValue([
      { date: '2026-10-16T00:00:00.000Z', total: '541.50', count: '1', expenses: [] },
      { date: '2026-10-15T00:00:00.000Z', total: '12.30', count: '1', expenses: [] },
    ]);
    const repo = new ExpenseRepository('user-1', { query } as unknown as Sequelize);

    const grouped = await repo.getGroupedExpenses('period-1');

    expect(grouped.map((group) => group.total)).toEqual([541.5, 12.3]);
  });
});
