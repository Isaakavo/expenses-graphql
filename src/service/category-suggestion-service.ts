import { Sequelize } from 'sequelize';
import { ExpenseRepository } from '../repository/expense-repository.js';

const RECENT_EXPENSE_LIMIT = 200;
const MIN_TOKEN_LENGTH = 4;

type SubCategoryScore = {
  count: number;
  mostRecentPayBefore: Date;
};

export type RecentExpenseForSuggestion = {
  concept: string;
  subCategoryId: string;
  payBefore: Date;
};

const stripDiacritics = (value: string): string =>
  value.normalize('NFD').replace(/[̀-ͯ]/g, '');

const normalizeDescription = (description: string): string[] =>
  stripDiacritics(description.toLowerCase())
    .replace(/[^\p{L}\p{N}\s]/gu, ' ')
    .split(/\s+/)
    .filter((token) => token.length >= MIN_TOKEN_LENGTH);

const intersects = (tokens: string[], otherTokens: string[]): boolean => {
  const otherSet = new Set(otherTokens);
  return tokens.some((token) => otherSet.has(token));
};

export class CategorySuggestionService {
  private expenseRepository: ExpenseRepository;
  userId: string;

  constructor(userId: string, sequelize: Sequelize) {
    this.expenseRepository = new ExpenseRepository(userId, sequelize);
    this.userId = userId;
  }

  async getRecentHistory(): Promise<RecentExpenseForSuggestion[]> {
    return this.expenseRepository.getRecentExpensesForSuggestion(
      this.userId,
      RECENT_EXPENSE_LIMIT
    );
  }

  async suggestSubCategory(input: {
    cardId: string;
    description: string;
    recentExpenses: RecentExpenseForSuggestion[];
  }): Promise<{ subCategoryId: string | null; source: 'HISTORY_MATCH' | 'NONE' }> {
    const tokens = normalizeDescription(input.description);

    if (tokens.length === 0) {
      return { subCategoryId: null, source: 'NONE' };
    }

    const matches = input.recentExpenses.filter((expense) =>
      intersects(tokens, normalizeDescription(expense.concept))
    );

    if (matches.length === 0) {
      return { subCategoryId: null, source: 'NONE' };
    }

    const scoresBySubCategoryId = matches.reduce<Record<string, SubCategoryScore>>(
      (acc, expense) => {
        const existing = acc[expense.subCategoryId];
        const mostRecentPayBefore =
          existing && existing.mostRecentPayBefore > expense.payBefore
            ? existing.mostRecentPayBefore
            : expense.payBefore;

        acc[expense.subCategoryId] = {
          count: (existing?.count ?? 0) + 1,
          mostRecentPayBefore,
        };
        return acc;
      },
      {}
    );

    const [bestSubCategoryId] = Object.entries(scoresBySubCategoryId).sort(
      ([, a], [, b]) => {
        if (b.count !== a.count) {
          return b.count - a.count;
        }
        return b.mostRecentPayBefore.getTime() - a.mostRecentPayBefore.getTime();
      }
    )[0];

    return { subCategoryId: bestSubCategoryId, source: 'HISTORY_MATCH' };
  }
}
