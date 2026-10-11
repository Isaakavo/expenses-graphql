import { QueryResolvers } from '../../../generated/graphql.js';
import { adaptCategoryToGraphql } from '../../../adapters/category-adapter.js';
import { CategoryService } from '../../../service/category-service.js';

export const categoryList: QueryResolvers['categoryList'] = async (
  _,
  { statuses },
  { user: { userId }, sequelizeClient }
) => {
  const categoryService = new CategoryService(userId, sequelizeClient);

  const categories = await categoryService.getCategoryList(statuses);

  return categories.map(adaptCategoryToGraphql);
};
