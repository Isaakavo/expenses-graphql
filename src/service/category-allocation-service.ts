import { IncomeRepository } from '../repository/income-repository.js';
import { ExpenseRepository } from '../repository/expense-repository.js';
import { Sequelize } from 'sequelize';

export class CategoryAllocationService {
  private expenseRepository: ExpenseRepository;
  private incomeRepository: IncomeRepository;
  userId: string;
  sequelize: Sequelize;

  constructor(sequelize: Sequelize, userId: string) {
    this.sequelize = sequelize;
    this.userId = userId;
    this.expenseRepository = new ExpenseRepository(userId);
    this.incomeRepository = new IncomeRepository(userId, sequelize);
  }

  async getCategoryAllocation(periodId: string, incomeId: string) {
    const [incomeSum, expenseSum] = await Promise.all([
      this.getIncomeSumByCategory(incomeId),
      this.getExpenseSumByCategory(periodId),
    ]);

    // TODO create types to avoid use of any
    const categorySum = incomeSum.map((income: any) => {
      const expense: any = expenseSum.find(
        (exp: any) => exp.categoryId === income.categoryId
      );
      return {
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
      income: incomeSum,
      expenses: await this.expenseRepository.getExpensesByPeriod(periodId),
    };
  }

  private async getIncomeSumByCategory(incomeId: string) {
    return this.incomeRepository.getIncomeSumCategoryById(incomeId);
  }

  private async getExpenseSumByCategory(periodId: string) {
    return this.expenseRepository.getExpensesSumByCategory(periodId);
  }
}
