import { Sequelize } from 'sequelize';
import { ExpenseRepository } from '../../../src/repository/expense-repository.js';
import { GoalRepository } from '../../../src/repository/goal-repository.js';
import { findAllExpensesWithCards } from '../../../src/utils/expenses-utils.js';
import { initModels } from '../../../src/models/init-models.js';
import { associateModels } from '../../../src/models/associations.js';
import { Category, Expense, SubCategory } from '../../../src/models/index.js';

const userA = '11111111-1111-4111-8111-111111111111';
const userB = '22222222-2222-4222-8222-222222222222';
const periodId = '44444444-4444-4444-8444-444444444444';

let sequelize: Sequelize;
let repo: ExpenseRepository;
let subCategoryId: string;
let categoryId: string;
let goalId: string;

type Role = 'CONTRIBUTION' | 'SPENDING' | null;

const newExpense = (concept: string, role: Role, total = 10) =>
  Expense.create({
    userId: userA,
    concept,
    total,
    payBefore: new Date('2026-02-01'),
    subCategoryId,
    periodId,
    goalId: role ? goalId : null,
    goalRole: role,
  });

const concepts = (expenses: { concept: string }[]) =>
  expenses.map((e) => e.concept).sort();

beforeEach(async () => {
  sequelize = new Sequelize('sqlite::memory:', { logging: false });
  initModels(sequelize);
  associateModels();
  await sequelize.sync({ force: true });
  await sequelize.query('PRAGMA foreign_keys = OFF');

  const category = await Category.create({ name: 'Home', userId: null });
  categoryId = category.id;
  const subCategory = await SubCategory.create({
    name: 'Rent',
    userId: null,
    categoryId: category.id,
  });
  subCategoryId = subCategory.id;
  const goal = await new GoalRepository(userA, sequelize).createGoal({
    name: 'Trip',
    targetAmount: 1000,
    startDate: '2026-01-01',
    endDate: null,
  });
  goalId = goal.id;

  repo = new ExpenseRepository(userA, sequelize);
  await newExpense('plain', null);
  await newExpense('contribution', 'CONTRIBUTION');
  await newExpense('spending', 'SPENDING', 100);
});

describe('ExpenseRepository goal spending exclusion', () => {
  it('getAllExpenses leaves SPENDING out and keeps unlinked and CONTRIBUTION rows', async () => {
    expect(concepts(await repo.getAllExpenses())).toEqual([
      'contribution',
      'plain',
    ]);
  });

  it('getAllExpenses keeps the caller where filter alongside the exclusion', async () => {
    const result = await repo.getAllExpenses({ where: { concept: 'spending' } });
    expect(result).toEqual([]);
    const plain = await repo.getAllExpenses({ where: { concept: 'plain' } });
    expect(concepts(plain)).toEqual(['plain']);
  });

  it('getExpensesByPeriod leaves SPENDING out', async () => {
    expect(concepts(await repo.getExpensesByPeriod(periodId))).toEqual([
      'contribution',
      'plain',
    ]);
  });

  it('getExpensesByCategory leaves SPENDING out', async () => {
    const byPeriod = await repo.getExpensesByCategory(periodId);
    expect(concepts(byPeriod)).toEqual(['contribution', 'plain']);
    const byDates = await repo.getExpensesByCategory(
      undefined,
      new Date('2026-01-01'),
      new Date('2026-03-01')
    );
    expect(concepts(byDates)).toEqual(['contribution', 'plain']);
  });

  it('getExpensesSumByCategory does not count SPENDING', async () => {
    const sums = await repo.getExpensesSumByCategory(periodId);
    expect(sums).toHaveLength(1);
    expect(sums[0].category.id).toBe(categoryId);
    expect(Number(sums[0].totalSpent)).toBe(20);
  });

  it('findAllExpensesWithCards (fortnight balance) leaves SPENDING out', async () => {
    const result = await findAllExpensesWithCards({ userId: userA });
    expect(concepts(result as { concept: string }[])).toEqual([
      'contribution',
      'plain',
    ]);
  });

  it('getExpenseByPK still returns a SPENDING row (needed by create and update)', async () => {
    const spending = await Expense.findOne({ where: { concept: 'spending' } });
    const found = await repo.getExpenseByPK(spending.id);
    expect(found.goalRole).toBe('SPENDING');
  });

  it('Goal.expenses (getGoalExpenses) still returns both roles', async () => {
    const goalExpenses = await new GoalRepository(
      userA,
      sequelize
    ).getGoalExpenses(goalId);
    expect(concepts(goalExpenses)).toEqual(['contribution', 'spending']);
  });

  it('is still scoped by user', async () => {
    const other = new ExpenseRepository(userB, sequelize);
    expect(await other.getAllExpenses()).toEqual([]);
  });
});
