import { adaptExpensesWithCard } from '../../../adapters/index.js';
import { MutationResolvers } from '../../../generated/graphql.js';
import { logger } from '../../../logger.js';
import { Card, Expense } from '../../../models/index.js';
import { updateElement } from '../../../utils/sequilize-utils.js';

export const updateExpense: MutationResolvers['updateExpense'] = async (
  _,
  { input },
  context
) => {
  try {
    const {
      user: { userId },
    } = context;
    const { category, concept, id, payBefore, total, cardId, comment } = input;

    const parameters = cardId
      ? {
          payBefore,
          total,
          cardId,
          comments: comment,
          concept,
          category,
        }
      : {
          payBefore,
          total,
          comments: comment,
          concept,
          category,
        };

    const updatedExpense = (await updateElement(
      Expense,
      userId,
      id,
      parameters
    )) as Expense[];

    const card = await Card.findOne({
      where: { userId, id: updatedExpense[0].cardId },
    });

    return adaptExpensesWithCard(updatedExpense[0], card);
  } catch (error) {
    logger.error(error);
    return error;
  }
};
