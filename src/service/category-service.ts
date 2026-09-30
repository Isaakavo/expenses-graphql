import { GraphQLError } from 'graphql';
import { Sequelize, UniqueConstraintError } from 'sequelize';
import { adaptCategoryModelDTO, adaptSubCategoryDTO } from '../adapters/category-adapter.js';
import { CategoryDTO, SubCategoryDTO } from '../dto/index.js';
import { CategoryRepository } from '../repository/category-repository.js';

export const CATEGORY_NAME_MAX_LENGTH = 50;

export const CategoryErrorCode = {
  BAD_USER_INPUT: 'BAD_USER_INPUT',
  DUPLICATE_NAME: 'DUPLICATE_NAME',
  NOT_FOUND: 'NOT_FOUND',
  READ_ONLY: 'READ_ONLY',
  CATEGORY_HAS_BUDGET: 'CATEGORY_HAS_BUDGET',
  LAST_SUBCATEGORY: 'LAST_SUBCATEGORY',
  CATEGORY_ARCHIVED: 'CATEGORY_ARCHIVED',
  SUBCATEGORY_ARCHIVED: 'SUBCATEGORY_ARCHIVED',
} as const;

type CategoryErrorCodeType = (typeof CategoryErrorCode)[keyof typeof CategoryErrorCode];

const categoryError = (
  code: CategoryErrorCodeType,
  message: string,
  extensions: Record<string, unknown> = {}
) => new GraphQLError(message, { extensions: { code, ...extensions } });

type NamedRow = { userId?: string | null; name: string; archivedAt?: Date | null };

/** Trims and collapses inner whitespace. */
export const normalizeCategoryName = (raw: string | null | undefined): string =>
  (raw ?? '').trim().replace(/\s+/g, ' ');

const byScopeThenName = (a: NamedRow, b: NamedRow) => {
  const scopeA = a.userId == null ? 0 : 1;
  const scopeB = b.userId == null ? 0 : 1;
  if (scopeA !== scopeB) {
    return scopeA - scopeB;
  }
  return a.name.toLowerCase().localeCompare(b.name.toLowerCase());
};

export type CreateCategoryParams = {
  name: string;
  subCategoryNames: string[];
};

export type CreateSubCategoryParams = {
  categoryId: string;
  name: string;
};

export class CategoryService {
  userId: string;
  sequelize: Sequelize;
  categoryRepository: CategoryRepository;

  constructor(userId: string, sequelize: Sequelize) {
    this.userId = userId;
    this.sequelize = sequelize;
    this.categoryRepository = new CategoryRepository(userId, sequelize);
  }

  /**
   * Categories visible to the user: global first then custom, alphabetically (case-insensitive);
   * sub categories ordered the same way. Archived items are excluded unless `includeArchived`.
   */
  async getCategoryList(includeArchived = false): Promise<CategoryDTO[]> {
    const categories = await this.categoryRepository.getCategoryList({ includeArchived });
    return categories
      .map(adaptCategoryModelDTO)
      .map((category) => ({
        ...category,
        subCategories: [...category.subCategories].sort(byScopeThenName),
      }))
      .sort(byScopeThenName);
  }

  async createCategory({ name, subCategoryNames }: CreateCategoryParams): Promise<CategoryDTO> {
    const categoryName = this.validateName(name, 'Category name');

    if (!subCategoryNames?.length) {
      throw categoryError(
        CategoryErrorCode.BAD_USER_INPUT,
        'A category requires at least one sub category'
      );
    }

    const normalizedSubCategoryNames = subCategoryNames.map((subName) =>
      this.validateName(subName, 'Sub category name')
    );
    const lowerNames = normalizedSubCategoryNames.map((subName) => subName.toLowerCase());
    if (new Set(lowerNames).size !== lowerNames.length) {
      throw categoryError(
        CategoryErrorCode.BAD_USER_INPUT,
        'Sub category names must be unique'
      );
    }

    const clashes = await this.categoryRepository.findCategoriesByName(categoryName);
    this.assertNoDuplicate(clashes, 'A category with this name already exists');

    const category = await this.withDuplicateGuard(() =>
      this.categoryRepository.createCategoryWithSubCategories(
        categoryName,
        normalizedSubCategoryNames
      )
    );
    const dto = adaptCategoryModelDTO(category);
    return { ...dto, subCategories: [...dto.subCategories].sort(byScopeThenName) };
  }

  async createSubCategory({ categoryId, name }: CreateSubCategoryParams): Promise<SubCategoryDTO> {
    const subCategoryName = this.validateName(name, 'Sub category name');

    const category = await this.categoryRepository.findCategoryById(categoryId);
    if (!category) {
      throw categoryError(CategoryErrorCode.NOT_FOUND, 'Category not found');
    }
    if (category.archivedAt) {
      throw categoryError(
        CategoryErrorCode.CATEGORY_ARCHIVED,
        'Cannot add a sub category to an archived category'
      );
    }

    const clashes = await this.categoryRepository.findSubCategoriesByName(
      categoryId,
      subCategoryName
    );
    this.assertNoDuplicate(clashes, 'A sub category with this name already exists in this category');

    const subCategory = await this.withDuplicateGuard(() =>
      this.categoryRepository.createSubCategory(categoryId, subCategoryName)
    );
    return adaptSubCategoryDTO(subCategory);
  }

  async archiveCategory(id: string): Promise<CategoryDTO> {
    const category = await this.getOwnCategory(id);

    if (await this.categoryRepository.hasCategorySetting(id)) {
      throw categoryError(
        CategoryErrorCode.CATEGORY_HAS_BUDGET,
        'Remove the budget percentage of this category before archiving it'
      );
    }

    return this.setCategoryArchivedAt(id, category.archivedAt ?? new Date());
  }

  async restoreCategory(id: string): Promise<CategoryDTO> {
    await this.getOwnCategory(id);
    return this.setCategoryArchivedAt(id, null);
  }

  async archiveSubCategory(id: string): Promise<SubCategoryDTO> {
    const subCategory = await this.getOwnSubCategory(id);

    if (subCategory.archivedAt) {
      return adaptSubCategoryDTO(subCategory);
    }

    const activeCount = await this.categoryRepository.countActiveSubCategories(
      subCategory.categoryId
    );
    if (activeCount <= 1) {
      throw categoryError(
        CategoryErrorCode.LAST_SUBCATEGORY,
        'Cannot archive the last active sub category; archive the category instead'
      );
    }

    const archived = await this.categoryRepository.setSubCategoryArchivedAt(id, new Date());
    return adaptSubCategoryDTO(archived);
  }

  async restoreSubCategory(id: string): Promise<SubCategoryDTO> {
    await this.getOwnSubCategory(id);
    const restored = await this.categoryRepository.setSubCategoryArchivedAt(id, null);
    return adaptSubCategoryDTO(restored);
  }

  /**
   * Guards expense create/update: the sub category must be visible to the user
   * (global or own) and neither it nor its category may be archived.
   */
  async assertSubCategoryAssignable(subCategoryId: string): Promise<void> {
    const subCategory = await this.categoryRepository.findSubCategoryWithCategory(subCategoryId);
    if (!subCategory) {
      throw categoryError(CategoryErrorCode.NOT_FOUND, 'Sub category not found');
    }
    if (subCategory.archivedAt || subCategory.category?.archivedAt) {
      throw categoryError(
        CategoryErrorCode.SUBCATEGORY_ARCHIVED,
        'Sub category (or its category) is archived'
      );
    }
  }

  private validateName(raw: string, label: string): string {
    const name = normalizeCategoryName(raw);
    if (!name) {
      throw categoryError(CategoryErrorCode.BAD_USER_INPUT, `${label} is required`);
    }
    if (name.length > CATEGORY_NAME_MAX_LENGTH) {
      throw categoryError(
        CategoryErrorCode.BAD_USER_INPUT,
        `${label} must be at most ${CATEGORY_NAME_MAX_LENGTH} characters`
      );
    }
    return name;
  }

  /** Any visible match (global, or the user's own incl. archived) is a clash. */
  private assertNoDuplicate(clashes: NamedRow[], message: string) {
    if (!clashes.length) {
      return;
    }
    const archived = clashes.every((clash) => clash.archivedAt != null);
    throw categoryError(
      CategoryErrorCode.DUPLICATE_NAME,
      archived ? `${message} (archived); restore it instead` : message,
      { archived }
    );
  }

  // Covers the race where a concurrent request inserts the same name between check and insert.
  private async withDuplicateGuard<T>(fn: () => Promise<T>): Promise<T> {
    try {
      return await fn();
    } catch (error) {
      if (error instanceof UniqueConstraintError) {
        throw categoryError(CategoryErrorCode.DUPLICATE_NAME, 'Name already exists', {
          archived: false,
        });
      }
      throw error;
    }
  }

  private async getOwnCategory(id: string) {
    const category = await this.categoryRepository.findCategoryById(id);
    if (!category) {
      throw categoryError(CategoryErrorCode.NOT_FOUND, 'Category not found');
    }
    if (category.userId == null) {
      throw categoryError(CategoryErrorCode.READ_ONLY, 'Global categories are read-only');
    }
    return category;
  }

  private async getOwnSubCategory(id: string) {
    const subCategory = await this.categoryRepository.findSubCategoryById(id);
    if (!subCategory) {
      throw categoryError(CategoryErrorCode.NOT_FOUND, 'Sub category not found');
    }
    if (subCategory.userId == null) {
      throw categoryError(CategoryErrorCode.READ_ONLY, 'Global sub categories are read-only');
    }
    return subCategory;
  }

  private async setCategoryArchivedAt(id: string, archivedAt: Date | null) {
    const category = await this.categoryRepository.setCategoryArchivedAt(id, archivedAt);
    const dto = adaptCategoryModelDTO(category);
    return { ...dto, subCategories: [...dto.subCategories].sort(byScopeThenName) };
  }
}
