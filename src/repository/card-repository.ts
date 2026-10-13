import { Card } from '../models/card.js';
import { logger } from '../logger.js';
import { Transaction, WhereOptions } from 'sequelize';

export type LinkProviderInput = {
  provider: string;
  providerAccountId: string;
  providerConnectionId: string;
  ciphertext: string;
  iv: string;
  authTag: string;
};

export class CardRepository {

  async findCardByUserId(userId: string, expenseId: string, where: WhereOptions = {}) {
    try {
      return Card.findOne({
        where: {
          ...where,
          id: expenseId,
          userId,
        },
      });
    } catch (error) {
      logger.error(`Error finding cards and tags ${error.message}`);
    }
  }

  async linkProvider(
    cardId: string,
    userId: string,
    input: LinkProviderInput,
    options: { transaction?: Transaction } = {}
  ): Promise<Card> {
    const card = await Card.findOne({
      where: { id: cardId, userId },
      transaction: options.transaction,
    });

    if (!card) {
      throw new Error(`Card ${cardId} not found for user`);
    }

    return card.update(
      {
        provider: input.provider,
        providerAccountId: input.providerAccountId,
        providerConnectionId: input.providerConnectionId,
        providerAccessTokenCiphertext: input.ciphertext,
        providerAccessTokenIv: input.iv,
        providerAccessTokenAuthTag: input.authTag,
        providerStatus: 'ACTIVE',
        providerLinkedAt: new Date(),
      },
      { transaction: options.transaction }
    );
  }

  async unlinkProvider(
    cardId: string,
    userId: string,
    options: { transaction?: Transaction } = {}
  ): Promise<Card> {
    const card = await Card.findOne({
      where: { id: cardId, userId },
      transaction: options.transaction,
    });

    if (!card) {
      throw new Error(`Card ${cardId} not found for user`);
    }

    return card.update(
      {
        provider: null,
        providerAccountId: null,
        providerConnectionId: null,
        providerAccessTokenCiphertext: null,
        providerAccessTokenIv: null,
        providerAccessTokenAuthTag: null,
        providerStatus: null,
        providerLinkedAt: null,
        providerLastSyncedAt: null,
      },
      { transaction: options.transaction }
    );
  }
}
