import { MutationResolvers } from 'generated/graphql';
import { CategorySettingsService } from '../../../service/category-setting-service.js';

export const deleteCategorySetting: MutationResolvers['deleteCategorySetting'] =
  async (_, { categoryId }, { user: { userId }, sequelizeClient }) => {
    const service = new CategorySettingsService(userId, sequelizeClient);

    return await service.deleteCategorySetting(categoryId);
  };
