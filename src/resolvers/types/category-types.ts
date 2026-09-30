import {
  CategoriesResolvers,
  CategoryOrigin,
  CategoryStatus,
  SubCategoryResolvers,
} from '../../generated/graphql.js';
import { toCategoryOrigin, toCategoryStatus } from '../../adapters/category-adapter.js';

// Parents may come from adapters (enums already set), Sequelize rows or DTOs (userId/archivedAt)
// or raw SQL rows (snake_case). Derive the enums defensively so the non-null fields always resolve.
type EnumSource = {
  status?: CategoryStatus | null;
  origin?: CategoryOrigin | null;
  userId?: string | null;
  user_id?: string | null;
  archivedAt?: Date | string | null;
  archived_at?: Date | string | null;
};

export const resolveStatus = (parent: EnumSource): CategoryStatus =>
  parent.status ?? toCategoryStatus(parent.archivedAt ?? parent.archived_at);

export const resolveOrigin = (parent: EnumSource): CategoryOrigin =>
  parent.origin ?? toCategoryOrigin(parent.userId ?? parent.user_id);

export const SubCategory: SubCategoryResolvers = {
  status: (parent) => resolveStatus(parent as EnumSource),
  origin: (parent) => resolveOrigin(parent as EnumSource),
};

export const Categories: CategoriesResolvers = {
  status: (parent) => resolveStatus(parent as EnumSource),
  origin: (parent) => resolveOrigin(parent as EnumSource),
};
