import { MutationResolvers } from '../../../generated/graphql.js';
import { Card } from '../../../models/index.js';
import { deleteElement, validateId } from '../../../utils/sequilize-utils.js';

export const deleteCard: MutationResolvers['deleteCard'] = async (
  _,
  { id },
  context
) => {
  const {
    user: { userId },
  } = context;

  await validateId(Card, userId, id);

  return deleteElement(Card, userId, id);
};
