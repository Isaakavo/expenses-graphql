import { CurrencyCode, GoalRole } from '../../../src/generated/graphql.js';
import { splitExpense } from '../../../src/utils/split-expense.js';

const input = {
  concept: 'Cena',
  total: 1000,
  periodId: 'period-1',
  payBefore: new Date('2026-11-20T00:00:00Z'),
  categoryId: 'cat-1',
  subCategoryId: 'sub-1',
  cardId: 'card-1',
};

describe('splitExpense', () => {
  it('keeps the own share as a regular expense and sends the rest to the goal', () => {
    const { own, reimbursable } = splitExpense(input, { goalId: 'event-1', amount: 600 });

    expect(own).toEqual({ ...input, total: 400 });
    expect(reimbursable).toEqual({
      ...input,
      total: 600,
      goalId: 'event-1',
      goalRole: GoalRole.SPENDING,
    });
  });

  it('creates only the goal expense when everything is reimbursable', () => {
    const { own, reimbursable } = splitExpense(input, { goalId: 'event-1', amount: 1000 });

    expect(own).toBeNull();
    expect(reimbursable.total).toBe(1000);
  });

  it('splits cents without losing any', () => {
    const { own, reimbursable } = splitExpense(
      { ...input, total: 100.01 },
      { goalId: 'event-1', amount: 33.33 }
    );

    expect(own?.total).toBe(66.68);
    expect(reimbursable.total).toBe(33.33);
  });

  it('splits the foreign amount and lets the backend convert each part', () => {
    const foreignAmount = { amount: 100, currency: CurrencyCode.USD, fixedRate: false };
    const { own, reimbursable } = splitExpense(
      { ...input, foreignAmount },
      { goalId: 'event-1', amount: 30 }
    );

    expect(own?.foreignAmount).toEqual({ ...foreignAmount, amount: 70 });
    expect(reimbursable.foreignAmount).toEqual({ ...foreignAmount, amount: 30 });
  });

  it('prorates the charged total of a fixed-rate foreign expense', () => {
    const foreignAmount = { amount: 3, currency: CurrencyCode.USD, fixedRate: true };
    const { own, reimbursable } = splitExpense(
      { ...input, total: 100, foreignAmount },
      { goalId: 'event-1', amount: 1 }
    );

    expect(reimbursable.total).toBe(33.33);
    expect(own?.total).toBe(66.67);
    expect(own?.foreignAmount?.amount).toBe(2);
  });

  it.each([0, -1, 1000.01, NaN])('rejects a reimbursable amount of %s', (amount) => {
    expect(() => splitExpense(input, { goalId: 'event-1', amount })).toThrow(
      expect.objectContaining({
        extensions: { code: 'VALIDATION_ERROR', argumentName: 'reimbursable' },
      })
    );
  });
});
