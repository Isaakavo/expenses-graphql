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
    const date = x.paymentDate ?? x.payBefore;
    const formatedMonth = format(x.paymentDate ?? x.payBefore, 'LLLL');
    const formatedDate = format(date, 'yyyy-MM-dd');
    monthMap[formatedMonth] = (monthMap[formatedMonth] ?? 0) + x.total;

    return {
      month: formatedMonth,
      date: formatedDate,
      total: monthMap[formatedMonth],
    };
  });

  const maxTotalByDate = {};

  for (const item of totalByMonth) {
    if (
      !maxTotalByDate[item.month] ||
      item.total > maxTotalByDate[item.month].total
    ) {
      maxTotalByDate[item.month] = item;
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
