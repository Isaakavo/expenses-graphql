import { QueryResolvers } from 'generated/graphql';
import {
  adaptExpensesDTOInput,
  adaptIncome,
  formatCurrency
} from '../../../adapters/income-adapter.js';
import { CategoryAllocationService } from '../../../service/category-allocation-service.js';

export const categoryAllocation: QueryResolvers['categoryAllocation'] = async (
  _,
  { input: { periodId, incomeId } },
  { user: { userId }, sequilizeClient }
) => {
  const categoryAllocationService = new CategoryAllocationService(
    sequilizeClient,
    userId
  );

  const allocations = await categoryAllocationService.getCategoryAllocation(
    periodId,
    incomeId
  );

  return {
    categorySum: allocations.categorySum.map((allocation) => ({
      category: allocation.category,
      allocated: formatCurrency(allocation.allocated),
      remaining: formatCurrency(allocation.remaining),
      sum: formatCurrency(allocation.sum),
    })),
    income: adaptIncome(allocations.income[0]),
    expenses: allocations.expenses.map((expense) => adaptExpensesDTOInput(expense)),
  };
};
