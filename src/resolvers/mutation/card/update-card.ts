import { adaptCard } from '../../../adapters/index.js';
import { MutationResolvers } from '../../../generated/graphql.js';
import { logger } from '../../../logger.js';
import { Card } from '../../../models/index.js';
import { updateElement } from '../../../utils/sequilize-utils.js';

export const updateCard: MutationResolvers['updateCard'] = async (
  _,
  { input },
  context
) => {
  try {
    const {
      user: { userId },
    } = context;
    const { bank, id, alias, isDebit, isDigital } = input;

    const updatedCard = await updateElement(Card, userId, id, {
      bank,
      alias,
      isDebit,
      isDigital,
    });

    return adaptCard(updatedCard[0] as Card);
  } catch (error) {
    logger.error(error);
    return error;
  }
};
