import { MutationResolvers } from '../../../generated/graphql.js';
import { adaptCategoryToGraphql } from '../../../adapters/category-adapter.js';
import { CategoryService } from '../../../service/category-service.js';

export const restoreCategory: MutationResolvers['restoreCategory'] = async (
  _,
  { id },
  { user: { userId }, sequelizeClient }
) => {
  const categoryService = new CategoryService(userId, sequelizeClient);

  return adaptCategoryToGraphql(await categoryService.restoreCategory(id));
};
