import { FixedExpenseFrequency, RecurrenceScope } from '../../../src/generated/graphql.js';
import { inScope, isPast, sequential, seriesDates } from '../../../src/utils/recurrence-utils.js';

const day = (iso: string) => new Date(`${iso}T00:00:00Z`);
const iso = (dates: Date[]) => dates.map((date) => date.toISOString().slice(0, 10));

describe('seriesDates', () => {
  it('advances monthly and clamps to the end of the month', () => {
    expect(iso(seriesDates(day('2026-01-31'), FixedExpenseFrequency.MONTHLY, 3))).toEqual([
      '2026-01-31',
      '2026-02-28',
      '2026-03-31',
    ]);
  });

  it('advances biweekly by 13 days starting at the given offset', () => {
    expect(iso(seriesDates(day('2026-04-01'), FixedExpenseFrequency.BIWEEKLY, 2, 1))).toEqual([
      '2026-04-14',
      '2026-04-27',
    ]);
  });
});

describe('isPast', () => {
  it('compares calendar days, not instants', () => {
    const today = new Date('2026-11-02T18:00:00Z');
    expect(isPast(day('2026-11-01'), today)).toBe(true);
    expect(isPast(day('2026-11-02'), today)).toBe(false);
  });
});

describe('inScope', () => {
  const series = [0, 1, 2, 3].map((recurrenceIndex) => ({ id: `e${recurrenceIndex}`, recurrenceIndex }));

  it.each([
    [RecurrenceScope.THIS, ['e2']],
    [RecurrenceScope.FOLLOWING, ['e2', 'e3']],
    [RecurrenceScope.ALL, ['e0', 'e1', 'e2', 'e3']],
  ])('selects %s', (scope, expected) => {
    expect(inScope(series, series[2], scope).map(({ id }) => id)).toEqual(expected);
  });
});

describe('sequential', () => {
  it('runs one item at a time in order', async () => {
    const started: number[] = [];
    const result = await sequential([1, 2, 3], async (item) => {
      started.push(item);
      await Promise.resolve();
      return item * 10;
    });
    expect(started).toEqual([1, 2, 3]);
    expect(result).toEqual([10, 20, 30]);
  });
});
