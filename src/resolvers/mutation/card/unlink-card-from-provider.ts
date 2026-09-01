import { adaptCard } from '../../../adapters/income-adapter.js';
import { MutationResolvers } from '../../../generated/graphql.js';
import { ProviderLinkService } from '../../../service/provider-link-service.js';

export const unlinkCardFromProvider: MutationResolvers['unlinkCardFromProvider'] = async (
  _,
  { cardId },
  context
) => {
  const {
    user: { userId },
    sequelizeClient,
  } = context;

  const service = new ProviderLinkService(userId, sequelizeClient);
  const card = await service.unlinkCardFromProvider(cardId);

  return adaptCard(card);
};
