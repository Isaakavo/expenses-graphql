export type CategoryDTO = {
  id: string;
  userId: string | null;
  name: string;
  subCategories: SubCategoryDTO[];
  archivedAt?: Date | null;
  createdAt: Date;
  updatedAt: Date;
};

export type SubCategoryDTO = {
  id: string;
  userId: string | null;
  categoryId: string;
  name: string;
  archivedAt?: Date | null;
  createdAt: Date;
  updatedAt: Date;
};

export type CategorySettingDTO = {
  id: string;
  userId: string;
  category: CategoryDTO;
  categoryId: string;
  percentage: number;
}