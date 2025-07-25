import { adaptCard, categoryAdapter } from '../../../adapters/index.js';
import { MutationResolvers } from '../../../generated/graphql.js';
import { logger } from '../../../logger.js';
import { Card, Expense, Period as PeriodModel } from '../../../models/index.js';
import { Date as CustomDate } from '../../../scalars/date.js';
import { Period } from '../../../generated/graphql.js';
import { addDays } from 'date-fns';
import { Op } from 'sequelize';

export const getOrCreateByPeriod = async (
  userId: string,
  date: Date,
  periodType: Period
): Promise<PeriodModel> => {
  if (!userId) {
    throw Error('Not Allowed');
  }

  const day = CustomDate.parseValue(date);

  // if (periodType === Period.WEEKLY) {
  const start = day;
  const end = addDays(start, 7);

  console.log(end);
  
// TODO validate how to handle the logic to create incomes or expenses by date range dynamically
// one possible solution: extract a period based on the periodType
// if weekly rest and sum 7 days and check if a period already exists, if yes, extract it and use the id
// if not, create it and extract the id
  const [period] = await PeriodModel.findOrCreate({
    defaults: { type: periodType, userId, startDate: start, endDate: end },
    where: {
      userId,
      // startDate: { [Op.lte]: start },
      endDate: { [Op.gte]: end },
      type: periodType,
    },
  });

  return period;
  // }
};

export const createExpense: MutationResolvers['createExpense'] = async (
  _,
  { input },
  context
) => {
  const { cardId, concept, total, comment, payBefore, category, periodType } =
    input;
  const {
    user: { userId },
  } = context;
  const conceptLengthMax = 100;

  // TODO improve error logic
  if (concept.length === 0) {
    logger.error('Concept is empty');
    throw new Error('Concept must not be empty');
  }

  if (total === 0 || total < 0) {
    logger.error('Total bad input');
    throw new Error('Total must not be negative or zero');
  }

  if (concept.length > conceptLengthMax) {
    logger.error('concept error');
    throw new Error(`Concept lenght must be lower than ${conceptLengthMax}`);
  }

  const card =
    cardId &&
    (await Card.findOne({
      where: {
        id: cardId,
        userId,
      },
    }));

  const serverDate = CustomDate.parseValue(new Date().toISOString());
  const parsedPayBefore = CustomDate.parseValue(payBefore);

  const period = await getOrCreateByPeriod(userId, payBefore, periodType);

  const newExpense = await Expense.create({
    userId,
    concept,
    total,
    periodId: period.id,
    category: categoryAdapter(category),
    cardId: card?.id,
    comments: comment,
    payBefore: parsedPayBefore,
    createdAt: serverDate,
    updatedAt: serverDate,
  });

  logger.info('Expense created');

  return {
    id: newExpense.id.toString(),
    userId: newExpense.userId,
    concept: newExpense.concept,
    category,
    total: newExpense.total,
    comment: newExpense.comments,
    payBefore: newExpense.payBefore,
    createdAt: newExpense.createdAt,
    updatedAt: newExpense.updatedAt,
    card: card && adaptCard(card),
  };
};
