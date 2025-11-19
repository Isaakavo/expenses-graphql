export type CategoryDTO = {
  id: string;
  userId: string | null;
  name: string;
  subCategories: SubCategoryDTO[];
  createdAt: Date;
  updatedAt: Date;
};

export type SubCategoryDTO = {
  id: string;
  userId: string | null;
  categoryId: string;
  name: string;
  createdAt: Date;
  updatedAt: Date;
};

export type CategorySettingDTO = {
  id: string;
  userId: string;
  categoryId: string;
  percentage: number;
}