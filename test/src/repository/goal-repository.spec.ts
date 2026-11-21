import { Sequelize } from 'sequelize';
import { GoalRepository } from '../../../src/repository/goal-repository.js';
import { initModels } from '../../../src/models/init-models.js';
import { associateModels } from '../../../src/models/associations.js';
import { Expense } from '../../../src/models/index.js';
import { GoalKind } from '../../../src/generated/graphql.js';

const userA = '11111111-1111-4111-8111-111111111111';
const userB = '22222222-2222-4222-8222-222222222222';
const anyId = '33333333-3333-4333-8333-333333333333';

let sequelize: Sequelize;
let repoA: GoalRepository;
let repoB: GoalRepository;

const newGoal = (name = 'Trip', startDate = '2026-01-01') => ({
  name,
  targetAmount: 1500.5,
  startDate,
  endDate: null,
});

const newExpense = (
  userId: string,
  goalId: string | null,
  role: 'CONTRIBUTION' | 'SPENDING' | null = null,
  payBefore = '2026-02-01'
) =>
  Expense.create({
    userId,
    concept: 'x',
    total: 10,
    payBefore: new Date(payBefore),
    subCategoryId: anyId,
    periodId: anyId,
    goalId,
    goalRole: goalId ? (role ?? 'CONTRIBUTION') : null,
  });

beforeEach(async () => {
  sequelize = new Sequelize('sqlite::memory:', { logging: false });
  initModels(sequelize);
  associateModels();
  await sequelize.sync({ force: true });
  // sync() re-enables FKs; the expenses FKs (sub category, period) are not under test
  await sequelize.query('PRAGMA foreign_keys = OFF');
  repoA = new GoalRepository(userA, sequelize);
  repoB = new GoalRepository(userB, sequelize);
});

describe('GoalRepository', () => {
  it('creates a goal and returns a DTO with numeric amount and ISO dates', async () => {
    const goal = await repoA.createGoal(newGoal());
    expect(goal.userId).toBe(userA);
    expect(goal.targetAmount).toBe(1500.5);
    expect(goal.startDate).toBe('2026-01-01');
    expect(goal.endDate).toBeNull();
  });

  it('lists goals ordered by startDate DESC, scoped by user', async () => {
    await repoA.createGoal(newGoal('Old', '2025-01-01'));
    await repoA.createGoal(newGoal('New', '2026-03-01'));
    await repoB.createGoal(newGoal('Other', '2026-05-01'));
    const goals = await repoA.getGoals();
    expect(goals.map((g) => g.name)).toEqual(['New', 'Old']);
  });

  it('does not return, update, close or delete goals of another user', async () => {
    const goal = await repoA.createGoal(newGoal());
    expect(await repoB.getGoalByPk(goal.id)).toBeNull();
    await expect(repoB.updateGoal(goal.id, { name: 'Hack' })).rejects.toThrow(
      'Goal not found'
    );
    await expect(repoB.closeGoal(goal.id, '2026-06-01')).rejects.toThrow(
      'Goal not found'
    );
    await expect(repoB.deleteGoal(goal.id)).rejects.toThrow('Goal not found');
    expect((await repoA.getGoalByPk(goal.id)).name).toBe('Trip');
  });

  it('updates and closes a goal', async () => {
    const goal = await repoA.createGoal(newGoal());
    const updated = await repoA.updateGoal(goal.id, { name: 'Car' });
    expect(updated.name).toBe('Car');
    const closed = await repoA.closeGoal(goal.id, '2026-06-01');
    expect(closed.endDate).toBe('2026-06-01');
  });

  it('delete unlinks the expenses instead of removing them', async () => {
    const goal = await repoA.createGoal(newGoal());
    const other = await repoA.createGoal(newGoal('Other'));
    const e1 = await newExpense(userA, goal.id);
    const e2 = await newExpense(userA, goal.id, 'SPENDING');
    const e3 = await newExpense(userA, other.id);

    await expect(repoA.deleteGoal(goal.id)).resolves.toBe(true);

    expect(await repoA.getGoalByPk(goal.id)).toBeNull();
    const reloaded = await Expense.findAll({ where: { userId: userA } });
    expect(reloaded).toHaveLength(3);
    const byId = (id: string) => reloaded.find((e) => e.id === id);
    expect(byId(e1.id).goalId).toBeNull();
    expect(byId(e1.id).goalRole).toBeNull();
    expect(byId(e2.id).goalId).toBeNull();
    expect(byId(e3.id).goalId).toBe(other.id);
  });

  describe('getExpensesByGoalIds', () => {
    // The sub category / category / period rows are not seeded, so the
    // inner-joined include would drop every expense; seed them.
    const seedRefs = async () => {
      const { Category, SubCategory } = await import(
        '../../../src/models/index.js'
      );
      await Category.create({ id: anyId, name: 'Cat', userId: null });
      await SubCategory.create({
        id: anyId,
        name: 'Sub',
        categoryId: anyId,
        userId: null,
      });
    };

    it('returns both roles ordered by payBefore ASC, only for the user', async () => {
      await seedRefs();
      const goal = await repoA.createGoal(newGoal());
      const late = await newExpense(userA, goal.id, 'SPENDING', '2026-03-01');
      const early = await newExpense(
        userA,
        goal.id,
        'CONTRIBUTION',
        '2026-01-15'
      );
      // another user's expense carrying the same goal id must not leak
      await newExpense(userB, goal.id, 'CONTRIBUTION', '2026-02-01');
      // unrelated expense of the same user
      await newExpense(userA, null);

      const expenses = await repoA.getExpensesByGoalIds([goal.id]);

      expect(expenses.map((e) => e.id)).toEqual([early.id, late.id]);
      expect(expenses.map((e) => e.goalRole)).toEqual([
        'CONTRIBUTION',
        'SPENDING',
      ]);
      expect(expenses.every((e) => e.goalId === goal.id)).toBe(true);
    });

    it('returns expenses of several goals in one call', async () => {
      await seedRefs();
      const g1 = await repoA.createGoal(newGoal('A'));
      const g2 = await repoA.createGoal(newGoal('B'));
      await newExpense(userA, g1.id);
      await newExpense(userA, g2.id);
      const notRequested = await repoA.createGoal(newGoal('C'));
      await newExpense(userA, notRequested.id);
      await newExpense(userB, g1.id);

      const expenses = await repoA.getExpensesByGoalIds([g1.id, g2.id]);

      expect(expenses).toHaveLength(2);
      expect(expenses.map((e) => e.goalId).sort()).toEqual(
        [g1.id, g2.id].sort()
      );
    });
  });

  describe('reimbursable goals', () => {
    const newEvent = async (repo: GoalRepository, userId: string) => {
      const { SavingsFund, Card } = await import('../../../src/models/index.js');
      const fund = await SavingsFund.create({ userId, name: 'Ahorros', currency: 'MXN' });
      const card = await Card.create({ userId, bank: 'BBVA', alias: 'Oro' });
      return repo.createGoal({
        name: 'Viaje',
        kind: GoalKind.REIMBURSABLE,
        targetAmount: null,
        startDate: '2026-11-25',
        fundId: fund.id,
        defaultCardId: card.id,
      });
    };

    it('returns the event with its fund and default card', async () => {
      const event = await newEvent(repoA, userA);
      expect(event.kind).toBe(GoalKind.REIMBURSABLE);
      expect(event.targetAmount).toBeNull();
      expect(event.fund).toMatchObject({ name: 'Ahorros', currency: 'MXN' });
      expect(event.defaultCard).toMatchObject({ bank: 'BBVA', alias: 'Oro' });
      expect((await repoA.getGoals())[0].fund?.id).toBe(event.fund?.id);
    });

    it('adds, updates and deletes reimbursements scoped by user', async () => {
      const event = await newEvent(repoA, userA);
      const input = { amount: 600.5, receivedOn: '2026-12-01', comment: null };
      const added = await repoA.addReimbursement(event.id, input);
      expect(added).toMatchObject({ goalId: event.id, amount: 600.5, receivedOn: '2026-12-01' });
      expect(await repoA.countReimbursements(event.id)).toBe(1);

      await expect(repoB.updateReimbursement(added.id, input)).rejects.toThrow(
        'Reimbursement not found'
      );
      await expect(repoB.deleteReimbursement(added.id)).rejects.toThrow(
        'Reimbursement not found'
      );
      expect(await repoB.getReimbursementsByGoalIds([event.id])).toEqual([]);

      const updated = await repoA.updateReimbursement(added.id, { ...input, comment: 'Nómina' });
      expect(updated.comment).toBe('Nómina');
      await expect(repoA.deleteReimbursement(added.id)).resolves.toBe(true);
      expect(await repoA.getReimbursementsByGoalIds([event.id])).toEqual([]);
    });

    it('orders reimbursements by receivedOn', async () => {
      const event = await newEvent(repoA, userA);
      await repoA.addReimbursement(event.id, { amount: 2, receivedOn: '2026-12-05', comment: null });
      await repoA.addReimbursement(event.id, { amount: 1, receivedOn: '2026-12-01', comment: null });
      const list = await repoA.getReimbursementsByGoalIds([event.id]);
      expect(list.map((r) => r.amount)).toEqual([1, 2]);
    });

    it('checks card ownership', async () => {
      const event = await newEvent(repoA, userA);
      expect(await repoA.cardExists(event.defaultCard!.id)).toBe(true);
      expect(await repoB.cardExists(event.defaultCard!.id)).toBe(false);
    });
  });
});
