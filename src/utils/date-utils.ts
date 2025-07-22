import {
  addMonths,
  addWeeks,
  endOfMonth,
  isWithinInterval,
  startOfMonth,
} from 'date-fns';
import { Fortnight } from '../generated/graphql.js';

export const calculateFortnight = (date: Date | string) => {

  let parsedDate: Date = date as Date;

  if (typeof date === 'string') {
    parsedDate = new Date(date);
  }
  
  const firstDayOfMonth = startOfMonth(parsedDate);
  const fifteenthDayOfMonth = endOfMonth(parsedDate).setDate(15);

  return isWithinInterval(parsedDate, {
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
