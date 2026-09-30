import { MutationResolvers } from '../../../generated/graphql.js';
import { adaptSubCategoryToGraphql } from '../../../adapters/category-adapter.js';
import { CategoryService } from '../../../service/category-service.js';

export const archiveSubCategory: MutationResolvers['archiveSubCategory'] = async (
  _,
  { id },
  { user: { userId }, sequelizeClient }
) => {
  const categoryService = new CategoryService(userId, sequelizeClient);

  return adaptSubCategoryToGraphql(await categoryService.archiveSubCategory(id));
};
