import { addDays, addMonths } from 'date-fns';
import { formatInTimeZone } from 'date-fns-tz';
import { FixedExpenseFrequency, RecurrenceScope } from '../generated/graphql.js';
import { FORTNIGHTLY_NUMBER_OF_DAYS } from '../repository/period-repository.js';

type SeriesMember = { id: string; recurrenceIndex: number | null };

export const isoDay = (date: Date) => formatInTimeZone(date, 'UTC', 'yyyy-MM-dd');

export const isPast = (date: Date, today: Date) => isoDay(date) < isoDay(today);

export const seriesDate = (
  anchor: Date,
  frequency: FixedExpenseFrequency,
  offset: number
) =>
  frequency === FixedExpenseFrequency.MONTHLY
    ? addMonths(anchor, offset)
    : addDays(anchor, FORTNIGHTLY_NUMBER_OF_DAYS * offset);

export const seriesDates = (
  anchor: Date,
  frequency: FixedExpenseFrequency,
  count: number,
  firstOffset = 0
) =>
  [...Array(count).keys()].map((i) =>
    seriesDate(anchor, frequency, firstOffset + i)
  );

export const inScope = <T extends SeriesMember>(
  series: T[],
  selected: SeriesMember,
  scope: RecurrenceScope
): T[] => {
  switch (scope) {
  case RecurrenceScope.THIS:
    return series.filter((member) => member.id === selected.id);
  case RecurrenceScope.FOLLOWING:
    return series.filter(
      (member) => member.recurrenceIndex >= selected.recurrenceIndex
    );
  case RecurrenceScope.ALL:
    return series;
  }
};

export const sequential = <T, R>(
  items: T[],
  work: (item: T, index: number) => Promise<R>
) =>
    items.reduce<Promise<R[]>>(
      async (previous, item, index) => [...(await previous), await work(item, index)],
      Promise.resolve([])
    );
