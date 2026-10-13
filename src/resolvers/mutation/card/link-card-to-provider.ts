import { adaptCard } from '../../../adapters/income-adapter.js';
import { adaptProviderNameFromGraphql } from '../../../adapters/card-adapter.js';
import { MutationResolvers } from '../../../generated/graphql.js';
import { ProviderLinkService } from '../../../service/provider-link-service.js';

export const linkCardToProvider: MutationResolvers['linkCardToProvider'] = async (
  _,
  { input },
  context
) => {
  const {
    user: { userId },
    sequelizeClient,
  } = context;

  const service = new ProviderLinkService(userId, sequelizeClient);

  const cards = await service.linkCardToProvider({
    provider: adaptProviderNameFromGraphql(input.provider),
    publicToken: input.publicToken,
    cards: input.cards.map((card) => ({
      cardId: card.cardId,
      providerAccountId: card.providerAccountId,
    })),
  });

  return cards.map(adaptCard);
};
