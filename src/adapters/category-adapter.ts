import {CategoryDTO, CategorySettingDTO, SubCategoryDTO} from '../dto';
import {Category, CategorySettings} from '../generated/graphql.js';

function formatNumber(num: number): number {
  const EPSILON = 1e-8;
  return Math.abs(num % 1) < EPSILON ? Math.trunc(num) : num;
}

export const categoryAdapter = (category: Category) =>
  Category[category.toUpperCase()];


export const adaptCategorySettings = (categorySettingDTO: CategorySettingDTO[]): CategorySettings => {
  return {
    percentageTotal: formatNumber(
      categorySettingDTO.reduce(
        (total, setting) => total + Number(setting.percentage),
        0
      ) * 100
    ),
    settings: categorySettingDTO.map((setting) => ({
      id: setting.id,
      userId: setting.userId,
      name: setting.category.name,
      categoryId: setting.categoryId,
      percentage: setting.percentage * 100,
    })),
  }
}

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

export const adaptCategorySettingDTO = (categorySetting): CategorySettingDTO => {
  return {
    id: categorySetting.id,
    userId: categorySetting.userId,
    category: adaptCategoryDTO(categorySetting.category),
    categoryId: categorySetting.categoryId,
    percentage: categorySetting.percentage,
  }
}