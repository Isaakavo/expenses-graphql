import {CategoryDTO, CategorySettingDTO, SubCategoryDTO} from '../dto';
import {
  Categories,
  Category,
  CategoryOrigin,
  CategorySettings,
  CategoryStatus,
  SubCategory,
} from '../generated/graphql.js';

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
    archivedAt: category?.archivedAt ?? null,
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
    archivedAt: subCategory?.archivedAt ?? null,
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

type CategoryLike = {
  id: string;
  userId?: string | null;
  name: string;
  archivedAt?: Date | null;
};

// Sequelize Category (with the `subCategory` include) → CategoryDTO
export const adaptCategoryModelDTO = (category): CategoryDTO => ({
  id: category.id,
  userId: category.userId ?? null,
  name: category.name,
  subCategories: (category.subCategory ?? []).map(adaptSubCategoryDTO),
  archivedAt: category.archivedAt ?? null,
  createdAt: category.createdAt,
  updatedAt: category.updatedAt,
});

// Single source of truth for the status / origin enums exposed through GraphQL.
export const toCategoryStatus = (archivedAt: Date | string | null | undefined): CategoryStatus =>
  archivedAt != null ? CategoryStatus.ARCHIVED : CategoryStatus.ACTIVE;

export const toCategoryOrigin = (userId: string | null | undefined): CategoryOrigin =>
  userId != null ? CategoryOrigin.CUSTOM : CategoryOrigin.DEFAULT;

export const adaptSubCategoryToGraphql = (subCategory: CategoryLike): SubCategory => ({
  id: subCategory.id,
  userId: subCategory.userId ?? null,
  name: subCategory.name,
  status: toCategoryStatus(subCategory.archivedAt),
  origin: toCategoryOrigin(subCategory.userId),
});

export const adaptCategoryToGraphql = (category: CategoryDTO): Categories => ({
  id: category.id,
  userId: category.userId ?? null,
  name: category.name,
  subCategory: (category.subCategories ?? []).map(adaptSubCategoryToGraphql),
  status: toCategoryStatus(category.archivedAt),
  origin: toCategoryOrigin(category.userId),
});
