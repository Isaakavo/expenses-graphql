import { adaptProviderNameFromGraphql } from '../../../adapters/card-adapter.js';
import { MutationResolvers } from '../../../generated/graphql.js';
import { ProviderLinkService } from '../../../service/provider-link-service.js';

export const createProviderLinkToken: MutationResolvers['createProviderLinkToken'] = async (
  _,
  { input },
  context
) => {
  const {
    user: { userId },
    sequelizeClient,
  } = context;

  const service = new ProviderLinkService(userId, sequelizeClient);

  return service.createLinkToken(adaptProviderNameFromGraphql(input.provider));
};
