import { CurrencyCode } from '../../../src/generated/graphql.js';
import { splitCents, splitSeriesTemplate } from '../../../src/utils/split-installments.js';

const template = {
  concept: 'Switch 2',
  total: 610,
  categoryId: 'cat-1',
  subCategoryId: 'sub-1',
};

const sum = (values: bigint[]) => values.reduce((acc, value) => acc + value, 0n);

describe('splitCents', () => {
  it('spreads the leftover cents across the series', () => {
    expect(splitCents(61000n, 12)).toEqual([
      5083n, 5083n, 5084n, 5083n, 5083n, 5084n, 5083n, 5083n, 5084n, 5083n, 5083n, 5084n,
    ]);
  });

  it.each([
    [12n, 12],
    [100n, 1],
    [999999n, 60],
    [101n, 7],
  ])('always adds up to %s cents over %s installments', (total, count) => {
    const parts = splitCents(total, count);
    expect(parts).toHaveLength(count);
    expect(sum(parts)).toBe(total);
    expect(Math.max(...parts.map(Number)) - Math.min(...parts.map(Number))).toBeLessThanOrEqual(1);
  });
});

describe('splitSeriesTemplate', () => {
  it('splits a domestic total', () => {
    expect(splitSeriesTemplate({ ...template, total: 0.12 }, 12).map((part) => part.total)).toEqual(
      Array(12).fill(0.01)
    );
  });

  it('rejects less than one cent per installment', () => {
    expect(() => splitSeriesTemplate({ ...template, total: 0.11 }, 12)).toThrow(
      expect.objectContaining({ extensions: { code: 'VALIDATION_ERROR', argumentName: 'total' } })
    );
    expect(() => splitSeriesTemplate({ ...template, total: NaN }, 2)).toThrow(
      expect.objectContaining({ extensions: { code: 'VALIDATION_ERROR', argumentName: 'total' } })
    );
  });

  it('splits the foreign amount and lets each installment convert at its own rate', () => {
    const foreignAmount = { amount: 100, currency: CurrencyCode.USD, fixedRate: false };
    const parts = splitSeriesTemplate({ ...template, total: 1800, foreignAmount }, 3);

    expect(parts.map((part) => part.foreignAmount?.amount)).toEqual([33.33, 33.33, 33.34]);
    expect(parts.map((part) => part.total)).toEqual([1800, 1800, 1800]);
  });

  it('prorates the charged total of a fixed-rate foreign series to the cent', () => {
    const foreignAmount = { amount: 100, currency: CurrencyCode.USD, fixedRate: true };
    const parts = splitSeriesTemplate({ ...template, total: 1700.5, foreignAmount }, 3);

    expect(parts.map((part) => part.foreignAmount?.amount)).toEqual([33.33, 33.33, 33.34]);
    expect(parts.map((part) => part.total)).toEqual([566.78, 566.77, 566.95]);
    expect(parts.reduce((acc, part) => acc + Math.round(part.total * 100), 0)).toBe(170050);
  });
});
