import { QueryResolvers } from 'generated/graphql';
import { CategoryService } from '../../../service/category-service.js';

export const categoryList: QueryResolvers['categoryList'] = async (
  _,
  __,
  { user: { userId }, sequelizeClient }
) => {
  const categoryService = new CategoryService(userId, sequelizeClient);

  const categories = await categoryService.getCategoryList();  

  return categories.map((category) => ({
    id: category.id,
    userId: category.userId,
    name: category.name,
    subCategory: category?.subCategory?.map((sub) => ({
      id: sub.id,
      name: sub.name,
      createdAt: sub.createdAt,
      updatedAt: sub.updatedAt,
    })),
    createdAt: category.createdAt,
    updatedAt: category.createdAt,
  }));
};
