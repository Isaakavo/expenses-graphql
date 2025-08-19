import { QueryResolvers } from 'generated/graphql';
import { CategoryAllocationService } from '../../../service/category-allocation-service.js';
import { adaptExpenses, adaptIncome, formatCurrency } from '../../../adapters/income-adapter.js';

export const categoryAllocation: QueryResolvers['categoryAllocation'] = async (
  _,
  __,
  { user: { userId }, sequilizeClient }
) => {
  const categoryAllocationService = new CategoryAllocationService(
    sequilizeClient,
    userId
  );

  const allocations = await categoryAllocationService.getCategoryAllocation(
    '6d7ecc4f-4a1c-4592-bd57-d6982d4d85c9',
    'acf613a8-02df-4802-a8b4-131a8092c94e'
  );

  return {
    categorySum:  allocations.categorySum.map((allocation) => ({
      category: allocation.category,
      allocated: formatCurrency(allocation.allocated),
      remaining: formatCurrency(allocation.remaining),
      sum: formatCurrency(allocation.sum),
    })),
    // TODO create types to avoid use of any
    income: (allocations.income as any).map((income) => (adaptIncome(income)))[0],
    expenses: allocations.expenses.map((expense) => (adaptExpenses(expense))),
  }
};
