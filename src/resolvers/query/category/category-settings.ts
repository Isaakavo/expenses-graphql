import { QueryResolvers } from 'generated/graphql';
import { CategorySettingsService } from '../../../service/category-setting-service.js';

export const categorySettings: QueryResolvers['categorySettings'] = async (
  _,
  __,
  context
) => {
  const {
    user: { userId },
    sequilizeClient,
  } = context;

  const categorySettingsService = new CategorySettingsService(
    userId,
    sequilizeClient
  );

  const settings = await categorySettingsService.getCategorySettings();

  return {
    settings: settings.map((setting) => ({
      id: setting.id,
      userId: setting.userId,
      name: setting.category.name,
      categoryId: setting.categoryId,
      percentage: setting.percentage * 100,
    })),
    percentageTotal: settings.reduce(
      (total, setting) => total + Number(setting.percentage),
      0
    ) * 100,
  };
};
