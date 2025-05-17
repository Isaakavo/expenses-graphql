import { adaptCard } from '../../../adapters/index.js';
import { logger } from '../../../logger.js';
import { Card } from '../../../models/index.js';
import { QueryResolvers } from '../../../generated/graphql.js';

export const cardList: QueryResolvers['cardList'] = async (_, input, context) => {
  const {
    user: { userId },
  } = context;

  const allCards = await Card.findAll({
    where: {
      userId,
    },
  });

  logger.info(`returning ${allCards.length} cards`);

  return allCards.map((card) => {
    return adaptCard(card);
  });
};
