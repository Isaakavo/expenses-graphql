import { CategoriesResolvers, SubCategoryResolvers } from '../../generated/graphql.js';

// Parents may come from adapters (flags already set), Sequelize rows or DTOs (userId/archivedAt)
// or raw SQL rows (snake_case). Derive the flags defensively so the non-null fields always resolve.
type FlagSource = {
  isCustom?: boolean | null;
  isArchived?: boolean | null;
  userId?: string | null;
  user_id?: string | null;
  archivedAt?: Date | string | null;
  archived_at?: Date | string | null;
};

export const resolveIsCustom = (parent: FlagSource): boolean =>
  parent.isCustom ?? (parent.userId ?? parent.user_id) != null;

export const resolveIsArchived = (parent: FlagSource): boolean =>
  parent.isArchived ?? (parent.archivedAt ?? parent.archived_at) != null;

export const SubCategory: SubCategoryResolvers = {
  isCustom: (parent) => resolveIsCustom(parent as FlagSource),
  isArchived: (parent) => resolveIsArchived(parent as FlagSource),
};

export const Categories: CategoriesResolvers = {
  isCustom: (parent) => resolveIsCustom(parent as FlagSource),
  isArchived: (parent) => resolveIsArchived(parent as FlagSource),
};
