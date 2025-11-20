import { QueryResolvers } from 'generated/graphql';
import { CategorySettingsService } from '../../../service/category-setting-service.js';
import {adaptCategorySettings} from '../../../adapters/category-adapter.js';

export const categorySettings: QueryResolvers['categorySettings'] = async (
  _,
  __,
  context
) => {
  const {
    user: { userId },
    sequelizeClient,
  } = context;

  const categorySettingsService = new CategorySettingsService(
    userId,
    sequelizeClient
  );

  const settings = await categorySettingsService.getCategorySettings();

  return adaptCategorySettings(settings)
};
