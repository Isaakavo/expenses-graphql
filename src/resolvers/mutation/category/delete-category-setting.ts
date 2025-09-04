import { MutationResolvers } from 'generated/graphql';
import { CategorySettingsService } from '../../../service/category-setting-service.js';

export const deleteCategorySetting: MutationResolvers['deleteCategorySetting'] =
  (_, { categoryId }, { user: { userId }, sequilizeClient }) => {
    const service = new CategorySettingsService(userId, sequilizeClient);

    return service.deleteCategorySetting(categoryId);
  };
