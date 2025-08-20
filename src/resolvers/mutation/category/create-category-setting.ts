import { MutationResolvers } from 'generated/graphql';
import { CategorySettingsService } from '../../../service/category-setting-service.js';

export const createCategorySetting: MutationResolvers['createCategorySetting'] =
  async (
    _,
    { input: { categoryId, allocationPercentage } },
    { user: { userId }, sequilizeClient }
  ) => {
    try {
      const categorySettingsService = new CategorySettingsService(
        userId,
        sequilizeClient
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
    } catch (error) {
      let errorMessage = error.message;
      
      if (error.name === 'SequelizeUniqueConstraintError') {
        errorMessage =
          'Category setting already exists';
      }

      return {
        id: '',
        message: errorMessage || 'Failed to create category setting',
      };
    }
  };
