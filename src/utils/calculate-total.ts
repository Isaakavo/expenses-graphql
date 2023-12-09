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
  const monthMap = {};

  const totalByMonth = databaseList.map((x) => {
    const formatedMonth = format(x.paymentDate ?? x.payBefore, 'LLLL');
    monthMap[formatedMonth] = (monthMap[formatedMonth] ?? 0) + x.total;

    return {
      date: formatedMonth,
      total: monthMap[formatedMonth],
    };
  });

  const maxTotalByDate = {};

  for (const item of totalByMonth) {
    if (
      !maxTotalByDate[item.date] ||
      item.total > maxTotalByDate[item.date].total
    ) {
      maxTotalByDate[item.date] = item;
    }
  }

  return Object.values(maxTotalByDate) as Array<Total>;
};

export const calculateTotalByFortnight = <T extends ElementFields, O>(
  databaseList: T[]
) => {
  const monthMap = {};

  const totalByFortnigth = databaseList.map((x) => {
    const date = x.paymentDate ?? x.payBefore;
    const formatedMonth = format(date, 'LLLL');
    const fortnight = calculateFortnight(date);
    const monthMapKey = `${formatedMonth}-${fortnight}`;

    monthMap[monthMapKey] = (monthMap[monthMapKey] ?? 0) + x.total;

    return {
      date: formatedMonth,
      fortnight,
      total: monthMap[monthMapKey],
    };
  });

  const maxTotalByDate = {};

  for (const item of totalByFortnigth) {
    if (
      !maxTotalByDate[item.date] ||
      item.total > maxTotalByDate[item.date].total
    ) {
      maxTotalByDate[`${item.date}-${item.fortnight}`] = item;
    }
  }

  return Object.values(maxTotalByDate) as Array<O>;
};
