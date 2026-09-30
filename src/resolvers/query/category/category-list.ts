import { QueryResolvers } from '../../../generated/graphql.js';
import { adaptCategoryToGraphql } from '../../../adapters/category-adapter.js';
import { CategoryService } from '../../../service/category-service.js';

export const categoryList: QueryResolvers['categoryList'] = async (
  _,
  { includeArchived },
  { user: { userId }, sequelizeClient }
) => {
  const categoryService = new CategoryService(userId, sequelizeClient);

  const categories = await categoryService.getCategoryList(includeArchived ?? false);

  return categories.map(adaptCategoryToGraphql);
};
