import { Sequelize } from 'sequelize';
import { initModels } from 'models/init-models.js';
import { associateModels } from 'models/associations.js';
import { Category } from 'models/category.js';
import { SubCategory } from 'models/sub-category.js';
import { Period } from 'models/periods.js';
import { Expense } from 'models/expense.js';
import { ExpenseRepository } from 'repository/expense-repository.js';

let sequelize: Sequelize;
let repository: ExpenseRepository;
let subCategoryId: string;
let periodId: string;

beforeEach(async () => {
  sequelize = new Sequelize('sqlite::memory:', { logging: false });
  initModels(sequelize);
  associateModels();
  await sequelize.sync({ force: true });
  repository = new ExpenseRepository('user-1', sequelize);

  const category = await Category.create({ userId: 'user-1', name: 'Food' });
  const subCategory = await SubCategory.create({
    userId: 'user-1',
    name: 'Groceries',
    categoryId: category.id,
  });
  subCategoryId = subCategory.id;

  const period = await Period.create({
    userId: 'user-1',
    type: 'FORTNIGHTLY',
    startDate: new Date('2026-04-01T00:00:00Z'),
    endDate: new Date('2026-04-14T00:00:00Z'),
  });
  periodId = period.id;
});

describe('ExpenseRepository.getRecentExpensesForSuggestion', () => {
  it('returns the user\'s recent expenses ordered by payBefore descending, scoped by userId', async () => {
    await Expense.create({
      userId: 'user-1',
      subCategoryId,
      periodId,
      concept: 'Older expense',
      total: 10,
      payBefore: new Date('2026-04-01T00:00:00Z'),
    });
    await Expense.create({
      userId: 'user-1',
      subCategoryId,
      periodId,
      concept: 'Newer expense',
      total: 20,
      payBefore: new Date('2026-04-10T00:00:00Z'),
    });
    await Expense.create({
      userId: 'user-2',
      subCategoryId,
      periodId,
      concept: 'Other user expense',
      total: 30,
      payBefore: new Date('2026-04-12T00:00:00Z'),
    });

    const result = await repository.getRecentExpensesForSuggestion('user-1', 200);

    expect(result).toHaveLength(2);
    expect(result[0].concept).toBe('Newer expense');
    expect(result[1].concept).toBe('Older expense');
  });

  it('respects the limit', async () => {
    await Promise.all(
      [1, 2, 3].map((day) =>
        Expense.create({
          userId: 'user-1',
          subCategoryId,
          periodId,
          concept: `Expense ${day}`,
          total: 10,
          payBefore: new Date(`2026-04-0${day}T00:00:00Z`),
        })
      )
    );

    const result = await repository.getRecentExpensesForSuggestion('user-1', 2);

    expect(result).toHaveLength(2);
  });
});
