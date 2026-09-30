import { describe, it, expect, beforeEach, vi, Mock } from 'vitest';
import { GraphQLError } from 'graphql';
import { Sequelize, UniqueConstraintError } from 'sequelize';
import {
  CategoryService,
  normalizeCategoryName,
} from '../../../src/service/category-service.js';
import { CategoryRepository } from '../../../src/repository/category-repository.js';

const userId = 'user-1';
const now = new Date('2026-09-30T00:00:00Z');

type RepoMethod = Exclude<keyof CategoryRepository, 'userId' | 'sequelize'>;
type MockRepo = Record<RepoMethod, Mock>;

let service: CategoryService;
let repo: MockRepo;

const sub = (overrides: Record<string, unknown> = {}) => ({
  id: 'sub-1',
  userId,
  categoryId: 'cat-1',
  name: 'Estadio',
  archivedAt: null,
  createdAt: now,
  updatedAt: now,
  ...overrides,
});

const category = (overrides: Record<string, unknown> = {}) => ({
  id: 'cat-1',
  userId,
  name: 'Sports',
  archivedAt: null,
  subCategory: [],
  createdAt: now,
  updatedAt: now,
  ...overrides,
});

const expectCode = async (
  promise: Promise<unknown>,
  code: string,
  extensions: Record<string, unknown> = {}
) => {
  const error = await promise.then(
    () => null,
    (e) => e
  );
  expect(error).toBeInstanceOf(GraphQLError);
  expect(error.extensions).toMatchObject({ code, ...extensions });
  return error as GraphQLError;
};

beforeEach(() => {
  repo = {
    getCategoryList: vi.fn(),
    findCategoryById: vi.fn(),
    findSubCategoryById: vi.fn(),
    findSubCategoryWithCategory: vi.fn(),
    findCategoriesByName: vi.fn().mockResolvedValue([]),
    findSubCategoriesByName: vi.fn().mockResolvedValue([]),
    createCategoryWithSubCategories: vi.fn(),
    createSubCategory: vi.fn(),
    setCategoryArchivedAt: vi.fn(),
    setSubCategoryArchivedAt: vi.fn(),
    countActiveSubCategories: vi.fn(),
    hasCategorySetting: vi.fn().mockResolvedValue(false),
  } as unknown as MockRepo;
  service = new CategoryService(userId, {} as Sequelize);
  service.categoryRepository = repo as unknown as CategoryRepository;
});

describe('normalizeCategoryName', () => {
  it('trims and collapses inner whitespace', () => {
    expect(normalizeCategoryName('  Food \t and\n  drinks  ')).toBe('Food and drinks');
  });

  it('keeps the casing and accents as typed', () => {
    expect(normalizeCategoryName('Béisbol')).toBe('Béisbol');
  });

  it('returns empty string for null/blank input', () => {
    expect(normalizeCategoryName(undefined)).toBe('');
    expect(normalizeCategoryName('   ')).toBe('');
  });
});

describe('getCategoryList', () => {
  it('excludes archived by default and passes includeArchived through', async () => {
    repo.getCategoryList.mockResolvedValue([]);
    await service.getCategoryList();
    expect(repo.getCategoryList).toHaveBeenCalledWith({ includeArchived: false });
    await service.getCategoryList(true);
    expect(repo.getCategoryList).toHaveBeenLastCalledWith({ includeArchived: true });
  });

  it('orders global first then custom, alphabetically case-insensitive (categories and sub categories)', async () => {
    repo.getCategoryList.mockResolvedValue([
      category({ id: 'c1', name: 'zoo', userId }),
      category({
        id: 'g2',
        name: 'LIFESTYLE',
        userId: null,
        subCategory: [
          sub({ id: 's1', name: 'concerts', userId }),
          sub({ id: 's2', name: 'GYM', userId: null }),
          sub({ id: 's3', name: 'Bars', userId }),
          sub({ id: 's4', name: 'CINEMA', userId: null }),
        ],
      }),
      category({ id: 'c2', name: 'Arcade', userId }),
      category({ id: 'g1', name: 'FOOD', userId: null }),
    ]);

    const result = await service.getCategoryList();

    expect(result.map((c) => c.name)).toEqual(['FOOD', 'LIFESTYLE', 'Arcade', 'zoo']);
    expect(result[1].subCategories.map((s) => s.name)).toEqual([
      'CINEMA',
      'GYM',
      'Bars',
      'concerts',
    ]);
  });

  it('maps archivedAt onto the DTOs', async () => {
    repo.getCategoryList.mockResolvedValue([
      category({ archivedAt: now, subCategory: [sub({ archivedAt: now })] }),
    ]);
    const [result] = await service.getCategoryList(true);
    expect(result.archivedAt).toEqual(now);
    expect(result.subCategories[0].archivedAt).toEqual(now);
  });
});

describe('createCategory', () => {
  it('creates the category with normalized names atomically', async () => {
    repo.createCategoryWithSubCategories.mockResolvedValue(
      category({
        name: 'Sports and fun',
        subCategory: [sub({ name: 'Estadio' }), sub({ id: 'sub-2', name: 'Béisbol' })],
      })
    );

    const result = await service.createCategory({
      name: '  Sports   and fun ',
      subCategoryNames: [' Estadio ', 'Béisbol'],
    });

    expect(repo.findCategoriesByName).toHaveBeenCalledWith('Sports and fun');
    expect(repo.createCategoryWithSubCategories).toHaveBeenCalledWith('Sports and fun', [
      'Estadio',
      'Béisbol',
    ]);
    expect(result.name).toBe('Sports and fun');
    expect(result.subCategories.map((s) => s.name)).toEqual(['Béisbol', 'Estadio']);
  });

  it.each([
    ['empty name', '   '],
    ['name longer than 50 chars', 'x'.repeat(51)],
  ])('rejects %s with BAD_USER_INPUT', async (_, name) => {
    await expectCode(
      service.createCategory({ name, subCategoryNames: ['a'] }),
      'BAD_USER_INPUT'
    );
    expect(repo.createCategoryWithSubCategories).not.toHaveBeenCalled();
  });

  it('accepts a name of exactly 50 chars after trimming', async () => {
    repo.createCategoryWithSubCategories.mockResolvedValue(category());
    await service.createCategory({ name: ` ${'x'.repeat(50)} `, subCategoryNames: ['a'] });
    expect(repo.createCategoryWithSubCategories).toHaveBeenCalledWith('x'.repeat(50), ['a']);
  });

  it('rejects an empty subCategoryNames list', async () => {
    await expectCode(service.createCategory({ name: 'Sports', subCategoryNames: [] }), 'BAD_USER_INPUT');
  });

  it('rejects an invalid sub category name', async () => {
    await expectCode(
      service.createCategory({ name: 'Sports', subCategoryNames: ['ok', '  '] }),
      'BAD_USER_INPUT'
    );
  });

  it('rejects case-insensitive duplicates inside the input list', async () => {
    await expectCode(
      service.createCategory({ name: 'Sports', subCategoryNames: ['Estadio', ' ESTADIO'] }),
      'BAD_USER_INPUT'
    );
    expect(repo.createCategoryWithSubCategories).not.toHaveBeenCalled();
  });

  it('rejects a name that matches a global category', async () => {
    repo.findCategoriesByName.mockResolvedValue([category({ name: 'LIFESTYLE', userId: null })]);
    await expectCode(
      service.createCategory({ name: 'lifestyle', subCategoryNames: ['a'] }),
      'DUPLICATE_NAME',
      { archived: false }
    );
    expect(repo.createCategoryWithSubCategories).not.toHaveBeenCalled();
  });

  it('rejects a name that matches one of the user own categories', async () => {
    repo.findCategoriesByName.mockResolvedValue([category({ name: 'Sports' })]);
    await expectCode(
      service.createCategory({ name: 'SPORTS', subCategoryNames: ['a'] }),
      'DUPLICATE_NAME',
      { archived: false }
    );
  });

  it('flags archived: true when the clash is with an archived category', async () => {
    repo.findCategoriesByName.mockResolvedValue([category({ archivedAt: now })]);
    await expectCode(
      service.createCategory({ name: 'Sports', subCategoryNames: ['a'] }),
      'DUPLICATE_NAME',
      { archived: true }
    );
  });

  it('maps a unique constraint race to DUPLICATE_NAME', async () => {
    repo.createCategoryWithSubCategories.mockRejectedValue(new UniqueConstraintError({}));
    await expectCode(
      service.createCategory({ name: 'Sports', subCategoryNames: ['a'] }),
      'DUPLICATE_NAME'
    );
  });

  it('propagates other repository errors', async () => {
    repo.createCategoryWithSubCategories.mockRejectedValue(new Error('DB down'));
    await expect(
      service.createCategory({ name: 'Sports', subCategoryNames: ['a'] })
    ).rejects.toThrow('DB down');
  });
});

describe('createSubCategory', () => {
  it('creates a custom sub category under a global category', async () => {
    repo.findCategoryById.mockResolvedValue(category({ userId: null, name: 'LIFESTYLE' }));
    repo.createSubCategory.mockResolvedValue(sub({ name: 'Concerts' }));

    const result = await service.createSubCategory({ categoryId: 'cat-1', name: ' Concerts ' });

    expect(repo.findSubCategoriesByName).toHaveBeenCalledWith('cat-1', 'Concerts');
    expect(repo.createSubCategory).toHaveBeenCalledWith('cat-1', 'Concerts');
    expect(result).toMatchObject({ name: 'Concerts', userId, archivedAt: null });
  });

  it('rejects an invalid name', async () => {
    await expectCode(service.createSubCategory({ categoryId: 'cat-1', name: '' }), 'BAD_USER_INPUT');
    expect(repo.findCategoryById).not.toHaveBeenCalled();
  });

  it('returns NOT_FOUND when the category is not visible', async () => {
    repo.findCategoryById.mockResolvedValue(null);
    await expectCode(service.createSubCategory({ categoryId: 'x', name: 'a' }), 'NOT_FOUND');
  });

  it('rejects creating under an archived category', async () => {
    repo.findCategoryById.mockResolvedValue(category({ archivedAt: now }));
    await expectCode(
      service.createSubCategory({ categoryId: 'cat-1', name: 'a' }),
      'CATEGORY_ARCHIVED'
    );
    expect(repo.createSubCategory).not.toHaveBeenCalled();
  });

  it('rejects a duplicate of a global sub category', async () => {
    repo.findCategoryById.mockResolvedValue(category({ userId: null }));
    repo.findSubCategoriesByName.mockResolvedValue([sub({ userId: null, name: 'GYM' })]);
    await expectCode(
      service.createSubCategory({ categoryId: 'cat-1', name: 'gym' }),
      'DUPLICATE_NAME',
      { archived: false }
    );
  });

  it('flags archived: true when the clash is with an archived sub category', async () => {
    repo.findCategoryById.mockResolvedValue(category());
    repo.findSubCategoriesByName.mockResolvedValue([sub({ archivedAt: now })]);
    await expectCode(
      service.createSubCategory({ categoryId: 'cat-1', name: 'ESTADIO' }),
      'DUPLICATE_NAME',
      { archived: true }
    );
  });

  it('maps a unique constraint race to DUPLICATE_NAME', async () => {
    repo.findCategoryById.mockResolvedValue(category());
    repo.createSubCategory.mockRejectedValue(new UniqueConstraintError({}));
    await expectCode(service.createSubCategory({ categoryId: 'cat-1', name: 'a' }), 'DUPLICATE_NAME');
  });
});

describe('archiveCategory', () => {
  it('archives an own category without budget', async () => {
    repo.findCategoryById.mockResolvedValue(category());
    repo.setCategoryArchivedAt.mockResolvedValue(category({ archivedAt: now }));

    const result = await service.archiveCategory('cat-1');

    expect(repo.hasCategorySetting).toHaveBeenCalledWith('cat-1');
    expect(repo.setCategoryArchivedAt).toHaveBeenCalledWith('cat-1', expect.any(Date));
    expect(result.archivedAt).toEqual(now);
  });

  it('is idempotent for an already archived category (keeps the original date)', async () => {
    const archivedAt = new Date('2026-01-01T00:00:00Z');
    repo.findCategoryById.mockResolvedValue(category({ archivedAt }));
    repo.setCategoryArchivedAt.mockResolvedValue(category({ archivedAt }));
    await service.archiveCategory('cat-1');
    expect(repo.setCategoryArchivedAt).toHaveBeenCalledWith('cat-1', archivedAt);
  });

  it('returns NOT_FOUND for unknown or other users categories', async () => {
    repo.findCategoryById.mockResolvedValue(null);
    await expectCode(service.archiveCategory('x'), 'NOT_FOUND');
  });

  it('returns READ_ONLY for global categories', async () => {
    repo.findCategoryById.mockResolvedValue(category({ userId: null }));
    await expectCode(service.archiveCategory('cat-1'), 'READ_ONLY');
    expect(repo.setCategoryArchivedAt).not.toHaveBeenCalled();
  });

  it('is blocked when the category has a budget setting', async () => {
    repo.findCategoryById.mockResolvedValue(category());
    repo.hasCategorySetting.mockResolvedValue(true);
    await expectCode(service.archiveCategory('cat-1'), 'CATEGORY_HAS_BUDGET');
    expect(repo.setCategoryArchivedAt).not.toHaveBeenCalled();
  });
});

describe('restoreCategory', () => {
  it('restores an own category (only the category row)', async () => {
    repo.findCategoryById.mockResolvedValue(category({ archivedAt: now }));
    repo.setCategoryArchivedAt.mockResolvedValue(category());
    const result = await service.restoreCategory('cat-1');
    expect(repo.setCategoryArchivedAt).toHaveBeenCalledWith('cat-1', null);
    expect(repo.setSubCategoryArchivedAt).not.toHaveBeenCalled();
    expect(result.archivedAt).toBeNull();
  });

  it('returns NOT_FOUND / READ_ONLY', async () => {
    repo.findCategoryById.mockResolvedValueOnce(null);
    await expectCode(service.restoreCategory('x'), 'NOT_FOUND');
    repo.findCategoryById.mockResolvedValueOnce(category({ userId: null }));
    await expectCode(service.restoreCategory('cat-1'), 'READ_ONLY');
  });
});

describe('archiveSubCategory', () => {
  it('archives an own sub category when others remain active', async () => {
    repo.findSubCategoryById.mockResolvedValue(sub());
    repo.countActiveSubCategories.mockResolvedValue(2);
    repo.setSubCategoryArchivedAt.mockResolvedValue(sub({ archivedAt: now }));

    const result = await service.archiveSubCategory('sub-1');

    expect(repo.countActiveSubCategories).toHaveBeenCalledWith('cat-1');
    expect(repo.setSubCategoryArchivedAt).toHaveBeenCalledWith('sub-1', expect.any(Date));
    expect(result.archivedAt).toEqual(now);
  });

  it('blocks archiving the last active sub category', async () => {
    repo.findSubCategoryById.mockResolvedValue(sub());
    repo.countActiveSubCategories.mockResolvedValue(1);
    await expectCode(service.archiveSubCategory('sub-1'), 'LAST_SUBCATEGORY');
    expect(repo.setSubCategoryArchivedAt).not.toHaveBeenCalled();
  });

  it('is a no-op for an already archived sub category', async () => {
    repo.findSubCategoryById.mockResolvedValue(sub({ archivedAt: now }));
    const result = await service.archiveSubCategory('sub-1');
    expect(repo.countActiveSubCategories).not.toHaveBeenCalled();
    expect(repo.setSubCategoryArchivedAt).not.toHaveBeenCalled();
    expect(result.archivedAt).toEqual(now);
  });

  it('returns NOT_FOUND for unknown or other users sub categories', async () => {
    repo.findSubCategoryById.mockResolvedValue(null);
    await expectCode(service.archiveSubCategory('x'), 'NOT_FOUND');
  });

  it('returns READ_ONLY for global sub categories', async () => {
    repo.findSubCategoryById.mockResolvedValue(sub({ userId: null }));
    await expectCode(service.archiveSubCategory('sub-1'), 'READ_ONLY');
  });
});

describe('restoreSubCategory', () => {
  it('restores an own sub category (even if its category is archived)', async () => {
    repo.findSubCategoryById.mockResolvedValue(sub({ archivedAt: now }));
    repo.setSubCategoryArchivedAt.mockResolvedValue(sub());
    const result = await service.restoreSubCategory('sub-1');
    expect(repo.setSubCategoryArchivedAt).toHaveBeenCalledWith('sub-1', null);
    expect(repo.findCategoryById).not.toHaveBeenCalled();
    expect(result.archivedAt).toBeNull();
  });

  it('returns NOT_FOUND / READ_ONLY', async () => {
    repo.findSubCategoryById.mockResolvedValueOnce(null);
    await expectCode(service.restoreSubCategory('x'), 'NOT_FOUND');
    repo.findSubCategoryById.mockResolvedValueOnce(sub({ userId: null }));
    await expectCode(service.restoreSubCategory('sub-1'), 'READ_ONLY');
  });
});

describe('assertSubCategoryAssignable', () => {
  it('passes for an active visible sub category', async () => {
    repo.findSubCategoryWithCategory.mockResolvedValue({ ...sub(), category: category() });
    await expect(service.assertSubCategoryAssignable('sub-1')).resolves.toBeUndefined();
  });

  it('returns NOT_FOUND when not visible to the user', async () => {
    repo.findSubCategoryWithCategory.mockResolvedValue(null);
    await expectCode(service.assertSubCategoryAssignable('x'), 'NOT_FOUND');
  });

  it('returns SUBCATEGORY_ARCHIVED for an archived sub category', async () => {
    repo.findSubCategoryWithCategory.mockResolvedValue({
      ...sub({ archivedAt: now }),
      category: category(),
    });
    await expectCode(service.assertSubCategoryAssignable('sub-1'), 'SUBCATEGORY_ARCHIVED');
  });

  it('returns SUBCATEGORY_ARCHIVED when the parent category is archived', async () => {
    repo.findSubCategoryWithCategory.mockResolvedValue({
      ...sub(),
      category: category({ archivedAt: now }),
    });
    await expectCode(service.assertSubCategoryAssignable('sub-1'), 'SUBCATEGORY_ARCHIVED');
  });
});
