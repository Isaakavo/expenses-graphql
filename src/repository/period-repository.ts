import { addDays } from 'date-fns';
import { Op } from 'sequelize';
import { Period } from '../generated/graphql.js';
import { Period as PeriodModel } from '../models/index.js';
import { Date as CustomDate } from '../scalars/date.js';

export class PeriodRepository {
  userId: string;
  periodType: Period;

  constructor(userId: string, periodType: Period) {
    this.userId = userId;
    this.periodType = periodType;
  }

  async upsertWeeklyPeriod(date: string) {
    
    
    const day = CustomDate.parseValue(date);

    // if (periodType === Period.WEEKLY) {
    const start = day;
    const end = addDays(start, 7);


    // TODO validate how to handle the logic to create incomes or expenses by date range dynamically
    // one possible solution: extract a period based on the periodType
    // if weekly rest and sum 7 days and check if a period already exists, if yes, extract it and use the id
    // if not, create it and extract the id
    const [period] = await PeriodModel.findOrCreate({
      defaults: {
        type: this.periodType,
        userId: this.userId,
        startDate: start,
        endDate: end,
      },
      where: {
        userId: this.userId,
        // startDate: { [Op.lte]: start },
        endDate: { [Op.gte]: end },
        type: this.periodType,
      },
    });    

    return period;
  }
}
