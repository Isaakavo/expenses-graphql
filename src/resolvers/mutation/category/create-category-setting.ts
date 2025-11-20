import { MutationResolvers } from 'generated/graphql';
import { CategorySettingsService } from '../../../service/category-setting-service.js';
import {logger} from '../../../logger.js';

export const createCategorySetting: MutationResolvers['createCategorySetting'] =
  async (
    _,
    { input: { categoryId, allocationPercentage } },
    { user: { userId }, sequelizeClient }
  ) => {
    try {
      const categorySettingsService = new CategorySettingsService(
        userId,
        sequelizeClient
      );

      const createdCategorySetting =
        await categorySettingsService.createCategorySetting({
          categoryId,
          percentage: allocationPercentage,
        });

      return {
        id: createdCategorySetting.id,
        message: 'Category setting created successfully',
      };
    } catch (e) {
      logger.error(e.message)
      throw e
    }
  };
