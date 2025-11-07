import { QueryResolvers } from 'generated/graphql';
import { CategorySettingsService } from '../../../service/category-setting-service.js';

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

  return {
    settings: settings.map((setting) => ({
      id: setting.id,
      userId: setting.userId,
      name: setting.category.name,
      categoryId: setting.categoryId,
      percentage: setting.percentage * 100,
    })),
    percentageTotal: formatNumber(
      settings.reduce(
        (total, setting) => total + Number(setting.percentage),
        0
      ) * 100
    ),
  };
};

function formatNumber(num: number): number {
  const EPSILON = 1e-8;
  return Math.abs(num % 1) < EPSILON ? Math.trunc(num) : num;
}
