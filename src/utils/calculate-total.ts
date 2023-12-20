import { format } from 'date-fns';
import { Total } from 'generated/graphql';
import { calculateFortnight } from './calculate-fortnight.js';

interface ElementFields {
  paymentDate?: Date;
  payBefore?: Date;
  total: number;
}

export const calcualteTotalByMonth = <T extends ElementFields>(
  databaseList: T[]
) => calculateTotals<T, Total>(databaseList, false);

export const calculateTotalByFortnight = <T extends ElementFields, O>(
  databaseList: T[]
) => calculateTotals<T, O>(databaseList, true);

const calculateTotals = <T extends ElementFields, O>(
  databaseList: T[],
  isFortnight?: boolean
) => {
  let monthTotal = {};
  let currentYear = '';

  const totalByMonth = databaseList.map((x) => {
    const date = x.paymentDate ?? x.payBefore;
    const formatedYear = format(date, 'yyyy');
    const formatedMonth = format(date, 'LLLL');
    const formatedDate = format(date, 'yyyy-MM-dd');
    const fortnight = calculateFortnight(date);
    const monthMapKey = isFortnight
      ? `${formatedMonth}-${fortnight}`
      : formatedMonth;

    if (currentYear !== formatedYear) {
      monthTotal = {};
    }

    monthTotal[monthMapKey] = (monthTotal[monthMapKey] ?? 0) + x.total;
    currentYear = formatedYear;

    return {
      year: formatedYear,
      month: formatedMonth,
      date: formatedDate,
      fortnight: isFortnight && fortnight,
      total: monthTotal[monthMapKey],
    };
  });

  const maxTotalByDate = {};

  for (const item of totalByMonth) {
    const itemYear = item.year;
    const itemMonth = item.month;
    const year = maxTotalByDate[itemYear];
    const monthKey = isFortnight
      ? `${item.month}-${item.fortnight}`
      : itemMonth;

    if (!year) {
      maxTotalByDate[itemYear] = {};
    }

    if (
      !maxTotalByDate[itemYear][monthKey] ||
      item.total > year[monthKey].total
    ) {
      maxTotalByDate[itemYear][monthKey] = { ...item };
    }
  }

  const month = Object.values(maxTotalByDate);
  const monthValues = month.values();
  const result = [];

  for (const value of monthValues) {
    const objValues = Object.values(value);
    result.push(objValues);
  }

  return result.flat(2).reverse() as Array<O>;
};
