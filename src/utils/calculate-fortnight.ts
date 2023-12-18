import { endOfMonth, isWithinInterval, startOfMonth } from 'date-fns';
import { Fortnight } from '../generated/graphql.js';

export const calculateFortnight = (date: Date) => {
  const firstDayOfMonth = startOfMonth(date);
  const fifteenthDayOfMonth = endOfMonth(date);
  fifteenthDayOfMonth.setDate(15);

  const isFirstFortnight = isWithinInterval(date, {
    start: firstDayOfMonth,
    end: fifteenthDayOfMonth,
  });

  if (isFirstFortnight) {
    return Fortnight.FIRST;
  }

  return Fortnight.SECOND;
};

export const fifteenthDayOfMonth = (date: Date | number) => {
  const fifteenthDayOfMonth = endOfMonth(date);
  return fifteenthDayOfMonth.setDate(15);
};
