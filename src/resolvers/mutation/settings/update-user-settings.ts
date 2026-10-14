import { MutationResolvers } from '../../../generated/graphql.js';
import { UserSettingsService } from '../../../service/user-settings-service.js';

export const updateUserSettings: MutationResolvers['updateUserSettings'] =
  async (_, { input }, { user: { userId }, sequelizeClient }) =>
    new UserSettingsService(userId, sequelizeClient).updateSettings(input);
