import { MutationResolvers } from 'generated/graphql';
import { CategorySettingsService } from '../../../service/category-setting-service.js';

export const deleteCategorySetting: MutationResolvers['deleteCategorySetting'] =
  (_, { categoryId }, { user: { userId }, sequelizeClient }) => {
    const service = new CategorySettingsService(userId, sequelizeClient);

    return service.deleteCategorySetting(categoryId);
  };
