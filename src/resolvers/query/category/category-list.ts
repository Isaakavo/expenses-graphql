import { QueryResolvers } from 'generated/graphql';
import { CategoryService } from '../../../service/category-service.js';

export const categoryList: QueryResolvers['categoryList'] = async (
  _,
  __,
  { user: { userId }, sequilizeClient }
) => {
  const categoryService = new CategoryService(userId, sequilizeClient);

  const categories = await categoryService.getCategoryList();

  return categories.map((category) => ({
    id: category.id,
    useId: category.userId,
    name: category.name,
    createdAt: category.createdAt,
    updatedAt: category.createdAt,
  }));
};
