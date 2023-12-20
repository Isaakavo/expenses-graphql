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
) => {
  let monthTotal = {};
  let currentYear = '';
  const totalByMonth = databaseList.map((x) => {
    const date = x.paymentDate ?? x.payBefore;
    const formatedYear = format(date, 'yyyy');
    const formatedMonth = format(x.paymentDate ?? x.payBefore, 'LLLL');
    const formatedDate = format(date, 'yyyy-MM-dd');

    if (currentYear !== formatedYear) {
      monthTotal = {};
    }

    monthTotal[formatedMonth] = (monthTotal[formatedMonth] ?? 0) + x.total;
    currentYear = formatedYear;

    return {
      year: formatedYear,
      month: formatedMonth,
      date: formatedDate,
      total: monthTotal[formatedMonth],
    };
  });

  const maxTotalByDate = {};

  for (const item of totalByMonth) {
    const itemYear = item.year;
    const itemMonth = item.month;
    const year = maxTotalByDate[itemYear];

    if (!year) {
      maxTotalByDate[itemYear] = {};
    }

    if (
      !maxTotalByDate[itemYear][itemMonth] ||
      item.total > year[itemMonth].total
    ) {
      maxTotalByDate[itemYear][itemMonth] = { ...item };
    }
  }

  const month = Object.values(maxTotalByDate);
  const monthValues = month.values();
  const result = [];

  for (const value of monthValues) {
    const objValues = Object.values(value);
    result.push(objValues);
  }

  return result.flat(2) as Array<Total>;
};

export const calculateTotalByFortnight = <T extends ElementFields, O>(
  databaseList: T[]
) => {
  const monthMap = {};

  const totalByFortnigth = databaseList.map((x) => {
    const date = x.paymentDate ?? x.payBefore;
    const formatedMonth = format(date, 'LLLL');
    const formatedDate = format(date, 'yyyy-MM-dd');
    const fortnight = calculateFortnight(date);
    const monthMapKey = `${formatedMonth}-${fortnight}`;

    monthMap[monthMapKey] = (monthMap[monthMapKey] ?? 0) + x.total;

    return {
      month: formatedMonth,
      date: formatedDate,
      fortnight,
      total: monthMap[monthMapKey],
    };
  });

  const maxTotalByDate = {};

  for (const item of totalByFortnigth) {
    if (
      !maxTotalByDate[item.month] ||
      item.total > maxTotalByDate[item.month].total
    ) {
      maxTotalByDate[`${item.month}-${item.fortnight}`] = item;
    }
  }

  return Object.values(maxTotalByDate) as Array<O>;
};
