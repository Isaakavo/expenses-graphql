import { describe, it, expect, beforeEach, vi } from 'vitest';
import { Sequelize } from 'sequelize';
import { CategorySuggestionService } from '../../../src/service/category-suggestion-service.js';

const userId = 'user-1';
let service: CategorySuggestionService;

const mockSequelize = {} as unknown as Sequelize;

const buildExpense = (
  concept: string,
  subCategoryId: string,
  payBefore: string
) => ({ concept, subCategoryId, payBefore: new Date(payBefore) });

type ServiceInternals = {
  expenseRepository: unknown;
};

const withInternals = (target: CategorySuggestionService) =>
  target as unknown as ServiceInternals;

beforeEach(() => {
  service = new CategorySuggestionService(userId, mockSequelize);
});

describe('CategorySuggestionService.suggestSubCategory', () => {
  it('returns NONE/null when there is no history at all', async () => {
    const result = await service.suggestSubCategory({
      cardId: 'card-1',
      description: 'Costco Wholesale',
      recentExpenses: [],
    });

    expect(result).toEqual({ subCategoryId: null, source: 'NONE' });
  });

  it('returns the matching subcategory with HISTORY_MATCH on one clear historical match', async () => {
    const result = await service.suggestSubCategory({
      cardId: 'card-1',
      description: 'Costco Wholesale #123',
      recentExpenses: [buildExpense('Costco Wholesale', 'sub-groceries', '2026-04-01')],
    });

    expect(result).toEqual({ subCategoryId: 'sub-groceries', source: 'HISTORY_MATCH' });
  });

  it('breaks a tie between two subcategories by most recent payBefore', async () => {
    const result = await service.suggestSubCategory({
      cardId: 'card-1',
      description: 'Amazon Purchase',
      recentExpenses: [
        buildExpense('Amazon Prime', 'sub-shopping', '2026-04-01'),
        buildExpense('Amazon Fresh', 'sub-groceries', '2026-04-10'),
      ],
    });

    expect(result).toEqual({ subCategoryId: 'sub-groceries', source: 'HISTORY_MATCH' });
  });

  it('picks the mode subcategory when one has more matches than another', async () => {
    const result = await service.suggestSubCategory({
      cardId: 'card-1',
      description: 'Amazon Purchase',
      recentExpenses: [
        buildExpense('Amazon Prime', 'sub-shopping', '2026-01-01'),
        buildExpense('Amazon Fresh', 'sub-groceries', '2026-04-10'),
        buildExpense('Amazon Basics', 'sub-shopping', '2026-04-05'),
      ],
    });

    expect(result).toEqual({ subCategoryId: 'sub-shopping', source: 'HISTORY_MATCH' });
  });

  it('matches despite case/punctuation differences', async () => {
    const result = await service.suggestSubCategory({
      cardId: 'card-1',
      description: 'Amazon',
      recentExpenses: [buildExpense('AMAZON.COM*1AB23', 'sub-shopping', '2026-04-01')],
    });

    expect(result).toEqual({ subCategoryId: 'sub-shopping', source: 'HISTORY_MATCH' });
  });

  it('matches accented Spanish descriptions against their unaccented history (and vice versa)', async () => {
    const result = await service.suggestSubCategory({
      cardId: 'card-1',
      description: 'Pago Peluqueria',
      recentExpenses: [buildExpense('Peluquería Marta', 'sub-personal-care', '2026-04-01')],
    });

    expect(result).toEqual({ subCategoryId: 'sub-personal-care', source: 'HISTORY_MATCH' });
  });

  it('returns NONE/null when nothing in history shares a token with the description', async () => {
    const result = await service.suggestSubCategory({
      cardId: 'card-1',
      description: 'Shell Gas Station',
      recentExpenses: [buildExpense('Netflix Subscription', 'sub-entertainment', '2026-04-01')],
    });

    expect(result).toEqual({ subCategoryId: null, source: 'NONE' });
  });
});

describe('CategorySuggestionService.getRecentHistory', () => {
  it('delegates to ExpenseRepository.getRecentExpensesForSuggestion scoped by userId', async () => {
    const expenses = [buildExpense('Costco Wholesale', 'sub-groceries', '2026-04-01')];
    const mockGetRecentExpensesForSuggestion = vi.fn().mockResolvedValue(expenses);
    withInternals(service).expenseRepository = {
      getRecentExpensesForSuggestion: mockGetRecentExpensesForSuggestion,
    };

    const result = await service.getRecentHistory();

    expect(mockGetRecentExpensesForSuggestion).toHaveBeenCalledWith(userId, 200);
    expect(result).toBe(expenses);
  });
});
