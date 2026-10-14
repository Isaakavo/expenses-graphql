import { QueryResolvers } from '../../../generated/graphql.js';
import { UserSettingsService } from '../../../service/user-settings-service.js';

export const userSettings: QueryResolvers['userSettings'] = async (
  _,
  __,
  { user: { userId }, sequelizeClient }
) => new UserSettingsService(userId, sequelizeClient).getSettings();
