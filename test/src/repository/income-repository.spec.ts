import { Category } from 'models';
import { associateModels } from 'models/associations';
import { CategorySettings } from 'models/category-settings';
import { IncomeCategoryAllocation } from 'models/income-category-allocation';
import { initModels } from 'models/init-models';
import { IncomeRepository } from 'repository/income-repository';
import { Sequelize } from 'sequelize';

let sequelize: Sequelize;
let incomeRepository: IncomeRepository;
const userId = '123';
const categorySettings = [
  { categoryId: 'cat1', percentage: 0.3 },
  { categoryId: 'cat2', percentage: 0.3 },
];

beforeEach(async () => {
  sequelize = new Sequelize('sqlite::memory:', { logging: false });
  initModels(sequelize);
  associateModels();

  await sequelize.sync({ force: true });
  incomeRepository = new IncomeRepository(userId, sequelize);
  await Category.bulkCreate(
    categorySettings.map((setting, index) => ({
      id: setting.categoryId,
      userId,
      name: setting.categoryId + index,
    }))
  );
  await CategorySettings.bulkCreate(
    categorySettings.map((setting) => ({
      userId,
      categoryId: setting.categoryId,
      percentage: setting.percentage,
    }))
  );
});

describe('Income respository', () => {
  it('should create income with category allocations', async () => {
    const incomeData = {
      userId,
      total: 1000,
      comment: 'Test Income',
      paymentDate: new Date(),
      createdAt: new Date(),
    };

    const income = await incomeRepository.createIncome(incomeData);

    expect(income).toBeDefined();
    expect(income.total).toBe(1000);

    const allocations = await IncomeCategoryAllocation.findAll({
      where: { incomeId: income.id },
    });

    expect(allocations.length).toBe(2);
    expect(allocations[0].amountAllocated).toBe(300);
    expect(allocations[1].amountAllocated).toBe(300);
  });

  it('should update income total if it already exists for the same period', async () => {
    const paymentDate = new Date();
    const incomeData = {
      userId,
      total: 1000,
      comment: 'First Income',
      paymentDate,
      createdAt: new Date(),
    };

    // Create first income
    await incomeRepository.createIncome(incomeData);

    // Update with new total
    const updatedIncomeData = {
      ...incomeData,
      total: 2000,
      comment: 'Updated Income',
    };

    const updatedIncome = await incomeRepository.createIncome(
      updatedIncomeData
    );

    expect(updatedIncome).toBeDefined();
    expect(updatedIncome.total).toBe(2000);

    const allocations = await IncomeCategoryAllocation.findAll({
      where: { incomeId: updatedIncome.id },
    });

    expect(allocations.length).toBe(2);
    expect(allocations[0].amountAllocated).toBe(600);
    expect(allocations[1].amountAllocated).toBe(600);
  });

  it('should not create duplicate income for the same period and user', async () => {
    const paymentDate = new Date();
    const incomeData = {
      userId,
      total: 1000,
      comment: 'Test Income',
      paymentDate,
      createdAt: new Date(),
    };

    const firstIncome = await incomeRepository.createIncome(incomeData);
    const secondIncome = await incomeRepository.createIncome(incomeData);

    // Should be the same record (not duplicated)
    expect(secondIncome.id).toBe(firstIncome.id);

    const count = await (
      await import('models')
    ).Income.count({
      where: { userId, periodId: firstIncome.periodId },
    });
    expect(count).toBe(1);
  });

  it('should update allocation percentage if category setting changes', async () => {
    const incomeData = {
      userId,
      total: 1000,
      comment: 'Test Income',
      paymentDate: new Date(),
      createdAt: new Date(),
    };

    // Create income and allocations
    const firstIncome = await incomeRepository.createIncome(incomeData);

    let allocations = await IncomeCategoryAllocation.findAll({
      where: { incomeId: firstIncome.id },
    });

    let cat1Allocation = allocations.find((a) => a.categoryId === 'cat1');
    expect(cat1Allocation.percentage).toBe(0.3);
    expect(cat1Allocation.amountAllocated).toBe(300);

    // Change category setting
    await CategorySettings.update(
      { percentage: 0.5 },
      { where: { userId, categoryId: 'cat1' } }
    );

    // Update income (should update allocation)
    const updatedIncome = await incomeRepository.createIncome(incomeData);

    allocations = await IncomeCategoryAllocation.findAll({
      where: { incomeId: updatedIncome.id },
    });

    cat1Allocation = allocations.find((a) => a.categoryId === 'cat1');
    expect(cat1Allocation.percentage).toBe(0.5);
    expect(cat1Allocation.amountAllocated).toBe(500);
  });
});
