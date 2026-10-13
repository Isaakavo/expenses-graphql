import { Sequelize } from 'sequelize';
import { Card } from '../models/card.js';
import { logger } from '../logger.js';
import { getProvider } from '../providers/provider-registry.js';
import { ProviderName } from '../providers/provider.types.js';
import { CardRepository } from '../repository/card-repository.js';
import { ProviderConnectionRepository } from '../repository/provider-connection-repository.js';
import { encryptToken } from '../security/token-cipher.js';

export type LinkCardAccountInput = {
  cardId: string;
  providerAccountId: string;
};

export type LinkCardToProviderInput = {
  provider: ProviderName;
  publicToken: string;
  cards: LinkCardAccountInput[];
};

export class ProviderLinkService {
  private cardRepository: CardRepository;
  private providerConnectionRepository: ProviderConnectionRepository;
  userId: string;
  sequelize: Sequelize;

  constructor(userId: string, sequelize: Sequelize) {
    this.cardRepository = new CardRepository();
    this.providerConnectionRepository = new ProviderConnectionRepository();
    this.userId = userId;
    this.sequelize = sequelize;
  }

  async createLinkToken(providerName: ProviderName): Promise<{ linkToken: string }> {
    const provider = getProvider(providerName);

    if (!provider.createLinkSession) {
      throw new Error(`Provider ${providerName} does not support link sessions`);
    }

    return provider.createLinkSession({ userId: this.userId });
  }

  async linkCardToProvider(input: LinkCardToProviderInput): Promise<Card[]> {
    if (input.cards.length === 0) {
      throw new Error('At least one card must be provided');
    }

    const provider = getProvider(input.provider);

    if (!provider.exchangeToken) {
      throw new Error(
        `Provider ${input.provider} does not support exchanging a public token`
      );
    }

    const { accessToken, providerConnectionId } = await provider.exchangeToken(
      input.publicToken
    );
    const encryptedToken = encryptToken(accessToken);

    const transaction = await this.sequelize.transaction();
    try {
      const [connection, created] = await this.providerConnectionRepository.findOrCreate(
        { userId: this.userId, provider: input.provider, providerConnectionId },
        { transaction }
      );

      if (!created) {
        await this.providerConnectionRepository.resetCursor(
          { id: connection.id },
          { transaction }
        );
      }

      const cards = await input.cards.reduce(
        async (previous, cardInput) => {
          const linkedCards = await previous;
          const card = await this.cardRepository.linkProvider(
            cardInput.cardId,
            this.userId,
            {
              provider: input.provider,
              providerAccountId: cardInput.providerAccountId,
              providerConnectionId,
              ciphertext: encryptedToken.ciphertext,
              iv: encryptedToken.iv,
              authTag: encryptedToken.authTag,
            },
            { transaction }
          );
          return [...linkedCards, card];
        },
        Promise.resolve([] as Card[])
      );

      await transaction.commit();
      return cards;
    } catch (error) {
      await transaction.rollback();
      logger.error(`Error linking cards to provider: ${error.message}`);
      throw error;
    }
  }

  async unlinkCardFromProvider(cardId: string): Promise<Card> {
    return this.cardRepository.unlinkProvider(cardId, this.userId);
  }
}
