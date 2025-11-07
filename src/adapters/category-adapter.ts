import { CategoryDTO, SubCategoryDTO } from '../dto';
import { Category } from '../generated/graphql.js';

export const categoryAdapter = (category: Category) =>
  Category[category.toUpperCase()];
// TODO arreglar el puto cagadero con los adpaters alvvvvvvvvv
export const adaptCategoryDTO = (category, subCategory?): CategoryDTO => {
  return {
    id: category.id,
    userId: category?.userId,
    name: category.name,
    subCategories: subCategory
      ? [adaptSubCategoryDTO(subCategory)]
      : category?.subCategories?.map(adaptSubCategoryDTO),
    createdAt: category.createdAt,
    updatedAt: category.updatedAt,
  };
};

export const adaptSubCategoryDTO = (subCategory): SubCategoryDTO => {
  return {
    id: subCategory.id,
    userId: subCategory.userId,
    categoryId: subCategory.categoryId,
    name: subCategory.name,
    createdAt: subCategory.createdAt,
    updatedAt: subCategory.updatedAt,
  };
};
