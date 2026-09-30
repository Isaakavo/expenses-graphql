import { SubCategory } from '../models/sub-category.js';
import { Category } from '../models/category.js';
import { CategorySettings } from '../models/category-settings.js';
import { Op, Sequelize, WhereOptions, col, fn, where } from 'sequelize';
import { CategoryStatus } from '../generated/graphql.js';

export const ALL_CATEGORY_STATUSES: readonly CategoryStatus[] = [
  CategoryStatus.ACTIVE,
  CategoryStatus.ARCHIVED,
];

export type CategoryListOptions = {
  /** Statuses to keep, applied independently to categories and sub categories. Default [ACTIVE]. */
  statuses?: readonly CategoryStatus[];
  categoryId?: string;
};

/** archived_at condition matching the requested statuses ({} when every status is requested). */
export const archivedAtWhere = (statuses: readonly CategoryStatus[]): WhereOptions => {
  const active = statuses.includes(CategoryStatus.ACTIVE);
  const archived = statuses.includes(CategoryStatus.ARCHIVED);
  if (active && archived) {
    return {};
  }
  if (archived) {
    return { archivedAt: { [Op.ne]: null } };
  }
  if (active) {
    return { archivedAt: null };
  }
  // No status requested: match nothing (the service rejects this case before reaching here).
  return { id: null };
};

export class CategoryRepository {
  userId: string;
  sequelize: Sequelize;

  constructor(userId: string, sequelize: Sequelize) {
    (this.userId = userId), (this.sequelize = sequelize);
  }

  // Rows the current user can see: global (seeded) rows or rows they own.
  private visibleScope() {
    return { [Op.or]: [{ userId: null }, { userId: this.userId }] };
  }

  private lowerNameEquals(name: string) {
    return where(fn('lower', col('name')), fn('lower', name));
  }

  /**
   * Categories visible to the user with their visible sub categories
   * (global or owned by the user — never other users' sub categories).
   * Ordering is applied in the service.
   */
  async getCategoryList({
    statuses = [CategoryStatus.ACTIVE],
    categoryId,
  }: CategoryListOptions = {}) {
    const statusWhere = archivedAtWhere(statuses);
    const categoryWhere: WhereOptions = {
      ...this.visibleScope(),
      ...(categoryId ? { id: categoryId } : {}),
      ...statusWhere,
    };
    const subCategoryWhere: WhereOptions = {
      ...this.visibleScope(),
      ...statusWhere,
    };

    return Category.findAll({
      where: categoryWhere,
      include: [
        {
          model: SubCategory,
          as: 'subCategory',
          required: false,
          where: subCategoryWhere,
        },
      ],
    });
  }

  async findCategoryById(id: string) {
    return Category.findOne({ where: { id, ...this.visibleScope() } });
  }

  async findSubCategoryById(id: string) {
    return SubCategory.findOne({ where: { id, ...this.visibleScope() } });
  }

  /** Visible sub category together with its (visible) parent category. */
  async findSubCategoryWithCategory(id: string) {
    return SubCategory.findOne({
      where: { id, ...this.visibleScope() },
      include: [
        {
          model: Category,
          as: 'category',
          required: true,
          where: this.visibleScope(),
        },
      ],
    }) as Promise<(SubCategory & { category: Category }) | null>;
  }

  /** Visible categories (global + own, archived included) whose name matches case-insensitively. */
  async findCategoriesByName(name: string) {
    return Category.findAll({
      where: {
        [Op.and]: [this.visibleScope(), this.lowerNameEquals(name)],
      },
    });
  }

  /** Visible sub categories of a category (global + own, archived included) whose name matches case-insensitively. */
  async findSubCategoriesByName(categoryId: string, name: string) {
    return SubCategory.findAll({
      where: {
        [Op.and]: [{ categoryId }, this.visibleScope(), this.lowerNameEquals(name)],
      },
    });
  }

  /** Creates a custom category and its sub categories atomically. */
  async createCategoryWithSubCategories(name: string, subCategoryNames: string[]) {
    const categoryId = await this.sequelize.transaction(async (transaction) => {
      const category = await Category.create(
        { userId: this.userId, name },
        { transaction }
      );
      await SubCategory.bulkCreate(
        subCategoryNames.map((subCategoryName) => ({
          userId: this.userId,
          categoryId: category.id,
          name: subCategoryName,
        })),
        { transaction }
      );
      return category.id;
    });

    const [created] = await this.getCategoryList({ statuses: ALL_CATEGORY_STATUSES, categoryId });
    return created;
  }

  async createSubCategory(categoryId: string, name: string) {
    return SubCategory.create({ userId: this.userId, categoryId, name });
  }

  /** Sets archived_at on a category owned by the user (null restores it). */
  async setCategoryArchivedAt(id: string, archivedAt: Date | null) {
    await Category.update({ archivedAt }, { where: { id, userId: this.userId } });
    const [category] = await this.getCategoryList({ statuses: ALL_CATEGORY_STATUSES, categoryId: id });
    return category;
  }

  /** Sets archived_at on a sub category owned by the user (null restores it). */
  async setSubCategoryArchivedAt(id: string, archivedAt: Date | null) {
    await SubCategory.update({ archivedAt }, { where: { id, userId: this.userId } });
    return this.findSubCategoryById(id);
  }

  /** Active (not archived) sub categories of a category that the user can see. */
  async countActiveSubCategories(categoryId: string) {
    return SubCategory.count({
      where: { categoryId, archivedAt: null, ...this.visibleScope() },
    });
  }

  async hasCategorySetting(categoryId: string) {
    const count = await CategorySettings.count({
      where: { userId: this.userId, categoryId },
    });
    return count > 0;
  }
}
