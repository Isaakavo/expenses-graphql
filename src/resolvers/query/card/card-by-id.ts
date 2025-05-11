import { GraphQLError } from 'graphql';
import { adaptCard } from '../../../adapters/index.js';
import { Card } from '../../../models/index.js';

export const cardById = async (_, input, context) => {
  const { cardId } = input;
  const {
    user: { userId },
  } = context;

  const card = await Card.findOne({
    where: {
      id: cardId,
      userId,
    },
  });

  if (!card) {
    throw new GraphQLError('The card id doesnt exists');
  }

  return adaptCard(card);
};
