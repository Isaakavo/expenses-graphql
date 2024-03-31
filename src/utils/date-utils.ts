import {
  addMonths,
  addWeeks,
  endOfMonth,
  isWithinInterval,
  startOfMonth,
} from 'date-fns';
import { Fortnight } from '../generated/graphql.js';

export const calculateFortnight = (date: Date) => {
  const firstDayOfMonth = startOfMonth(date);
  const fifteenthDayOfMonth = endOfMonth(date).setDate(15);

  return isWithinInterval(date, {
    start: firstDayOfMonth,
    end: fifteenthDayOfMonth,
  })
    ? Fortnight.FIRST
    : Fortnight.SECOND;
};

export const fifteenthDayOfMonth = (date: Date | number) =>
  endOfMonth(date).setDate(15);

export const calculateNumberOfBiWeeklyWeeks = (
  startDate: Date,
  frequency: number
) => addWeeks(startDate, frequency);

export const calculateNumberOfMonthWeeks = (
  startDate: Date,
  frequency: number
) => addMonths(startDate, frequency);
