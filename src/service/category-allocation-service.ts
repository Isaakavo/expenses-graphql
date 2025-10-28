import { IncomeRepository } from '../repository/income-repository.js';
import { ExpenseRepository } from '../repository/expense-repository.js';
import { Sequelize } from 'sequelize';
import { adaptIncomeDTO } from '../adapters/income-adapter.js';

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

    const categorySum = incomeSum.map((income) => {
      const expense = expenseSum.find(
        (exp) => exp.category.id === income.category.id
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

    // console.log({incomeIncome: (incomeSum as any)[0].income});
    

    return {
      categorySum,
      income: incomeSum.map((inc) => adaptIncomeDTO(inc.income)),
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
