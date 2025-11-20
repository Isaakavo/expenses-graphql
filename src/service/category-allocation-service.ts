import {IncomeRepository} from '../repository/income-repository.js';
import {ExpenseRepository} from '../repository/expense-repository.js';
import {Sequelize} from 'sequelize';
import {adaptIncomeCategoryAllocationDTO, adaptIncomeDTO} from '../adapters/income-adapter.js';
import {CategoryAllocationRepository} from '../repository/category-allocation-repository.js';

export class CategoryAllocationService {
  private expenseRepository: ExpenseRepository;
  private incomeRepository: IncomeRepository;
  private categoryAllocationRepository: CategoryAllocationRepository;
  userId: string;
  sequelize: Sequelize;

  constructor(userId: string, sequelize: Sequelize) {
    this.sequelize = sequelize;
    this.userId = userId;
    this.expenseRepository = new ExpenseRepository(userId);
    this.incomeRepository = new IncomeRepository(userId, sequelize);
    this.categoryAllocationRepository = new CategoryAllocationRepository(userId, sequelize);
  }

  async getCategoryAllocationByPk(id: string) {
    return this.categoryAllocationRepository.getCategoryAllocationByPk(id);
  }

  async getCategoryAllocation(periodId: string, incomeId: string) {
    const [incomeSum, expenseSum] = await Promise.all([
      this.getIncomeSumByCategory(incomeId),
      this.getExpenseSumByCategory(periodId),
    ]);

    const categorySum = incomeSum.map((income) => {
      const expense = expenseSum.find(
        (exp) => exp.category.id === income.category.id
      );
      return {
        id: income.id,
        category: {
          id: income.category.id,
          name: income.category.name,
          percentage: income.percentage * 100,
        },
        allocated: income.amountAllocated,
        sum: expense?.totalSpent || 0,
        remaining: income.amountAllocated - (expense?.totalSpent || 0),
      };
    });

    return {
      categorySum,
      income: incomeSum.map((inc) => adaptIncomeDTO(inc.income)),
      expenses: await this.expenseRepository.getExpensesByPeriod(periodId),
    };
  }

  async updateCategoryAllocation(incomeId: string, settingId: string, percentage: number) {
    const income = this.incomeRepository.getIncomeByPK(incomeId);

    const newAmountAllocated = (await income).total * percentage;

    const updated = await this.categoryAllocationRepository
      .updateCategoryAllocation(settingId, percentage, newAmountAllocated)

    return adaptIncomeCategoryAllocationDTO(updated)
  }

  private async getIncomeSumByCategory(incomeId: string) {
    return this.incomeRepository.getIncomeSumCategoryById(incomeId);
  }

  private async getExpenseSumByCategory(periodId: string) {
    return this.expenseRepository.getExpensesSumByCategory(periodId);
  }
}
