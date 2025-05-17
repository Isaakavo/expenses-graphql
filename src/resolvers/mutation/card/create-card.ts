import { GraphQLError } from 'graphql';
import { adaptCard } from '../../../adapters/income-adapter.js';
import { MutationResolvers } from '../../../generated/graphql.js';
import { logger } from '../../../logger.js';
import { Card } from '../../../models/index.js';

export const createCard: MutationResolvers['createCard'] = async (
  _,
  { input },
  context
) => {
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
