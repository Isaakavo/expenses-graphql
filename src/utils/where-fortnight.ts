import { endOfMonth, startOfMonth } from 'date-fns';
import { Op, WhereOptions } from 'sequelize';
import { Fortnight } from '../generated/graphql.js';
import { Date } from '../scalars/date.js';
import {
  calculateFortnight,
  fifteenthDayOfMonth,
} from './calculate-fortnight.js';

export const whereByFornight = (
  userId: string,
  date: Date,
  fortnightWhere: string,
  where: WhereOptions | undefined = undefined
) => {
  const parsedBeforeDate = Date.parseValue(date);
  const fortnight = calculateFortnight(parsedBeforeDate);
  const definedFortnightWhere = {
    userId,
    [fortnightWhere]:
      fortnight === Fortnight.First
        ? {
          [Op.gte]: startOfMonth(parsedBeforeDate),
          [Op.lte]: fifteenthDayOfMonth(parsedBeforeDate),
        }
        : {
          [Op.gte]: fifteenthDayOfMonth(parsedBeforeDate),
          [Op.lte]: endOfMonth(parsedBeforeDate),
        },

  }
  return !where ? definedFortnightWhere : { 
    ...where,
    ...definedFortnightWhere
  }
};

export const whereByMonth = (
  userId: string,
  date: Date,
  fortnightWhere: string
) => {
  const parsedBeforeDate = Date.parseValue(date);

  return {
    userId,
    [fortnightWhere]: {
      [Op.gte]: startOfMonth(parsedBeforeDate),
      [Op.lte]: endOfMonth(parsedBeforeDate),
    },
  };
};
