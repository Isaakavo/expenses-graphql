import { GraphQLError } from 'graphql';
import { Card } from '../../../models/index.js';
import { adaptCard } from '../../../adapters/income-adapter.js';
import { logger } from '../../../logger.js';

export const createCard = async (_, { input }, context) => {
  try {
    const { alias, bank, isDigital, isDebit } = input;
    const {
      user: { userId },
    } = context;

    if (!bank) {
      throw new GraphQLError('You need to pass a bank value');
    }

    const newCard = await Card.create({
      userId,
      alias,
      bank,
      isDebit,
      isDigital,
    });

    return adaptCard(newCard);
  } catch (error) {
    logger.error(`Error creating card ${error.message}`);
    throw error;
  }
};
