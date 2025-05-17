import { adaptCard, categoryAdapter } from '../../../adapters/index.js';
import { MutationResolvers } from '../../../generated/graphql.js';
import { logger } from '../../../logger.js';
import { Card, Expense } from '../../../models/index.js';
import { Date as CustomDate } from '../../../scalars/date.js';

export const createExpense: MutationResolvers['createExpense'] = async (
  _,
  { input },
  context
) => {
  const { cardId, concept, total, comment, payBefore, category } = input;
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

  const newExpense = await Expense.create({
    userId,
    concept,
    total,
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
