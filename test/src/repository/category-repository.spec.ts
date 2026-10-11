import { Sequelize } from 'sequelize';
import { Category } from '../../../src/models/category.js';
import { SubCategory } from '../../../src/models/sub-category.js';
import { associateModels } from '../../../src/models/associations.js';
import { initModels } from '../../../src/models/init-models.js';
import { CategoryRepository } from '../../../src/repository/category-repository.js';
import { CategoryStatus } from '../../../src/generated/graphql.js';

const userId = '11111111-1111-1111-1111-111111111111';
const otherUserId = '22222222-2222-2222-2222-222222222222';
const archivedAt = new Date('2026-09-30T00:00:00Z');

let sequelize: Sequelize;
let repository: CategoryRepository;

// Tree fixture:
//  active-cat   (global, active)  -> active-sub, archived-sub, other-user-sub (archived, not visible)
//  archived-cat (custom, archived) -> active-sub-2, archived-sub-2
beforeEach(async () => {
  sequelize = new Sequelize('sqlite::memory:', { logging: false });
  initModels(sequelize);
  associateModels();
  await sequelize.sync({ force: true });
  repository = new CategoryRepository(userId, sequelize);

  await Category.bulkCreate([
    { id: 'active-cat', userId: null, name: 'LIFESTYLE' },
    { id: 'archived-cat', userId, name: 'Sports', archivedAt },
  ]);
  await SubCategory.bulkCreate([
    { id: 'active-sub', userId: null, categoryId: 'active-cat', name: 'GYM' },
    { id: 'archived-sub', userId, categoryId: 'active-cat', name: 'Bars', archivedAt },
    {
      id: 'other-user-sub',
      userId: otherUserId,
      categoryId: 'active-cat',
      name: 'Hidden',
      archivedAt,
    },
    { id: 'active-sub-2', userId, categoryId: 'archived-cat', name: 'Estadio' },
    { id: 'archived-sub-2', userId, categoryId: 'archived-cat', name: 'Palcos', archivedAt },
  ]);
});

const tree = async (statuses?: CategoryStatus[]) => {
  const categories = await repository.getCategoryList(statuses ? { statuses } : {});
  return Object.fromEntries(
    categories.map((category) => [
      category.id,
      (category.get('subCategory') as SubCategory[]).map((sub) => sub.id).sort(),
    ])
  );
};

describe('CategoryRepository.getCategoryList statuses filter', () => {
  it('defaults to [ACTIVE] at both levels', async () => {
    expect(await tree()).toEqual({ 'active-cat': ['active-sub'] });
  });

  it('[ACTIVE] returns only active categories with only active sub categories', async () => {
    expect(await tree([CategoryStatus.ACTIVE])).toEqual({ 'active-cat': ['active-sub'] });
  });

  it('[ARCHIVED] returns only archived categories with only archived sub categories', async () => {
    expect(await tree([CategoryStatus.ARCHIVED])).toEqual({
      'archived-cat': ['archived-sub-2'],
    });
  });

  it('[ACTIVE, ARCHIVED] returns everything the user can see', async () => {
    expect(await tree([CategoryStatus.ACTIVE, CategoryStatus.ARCHIVED])).toEqual({
      'active-cat': ['active-sub', 'archived-sub'],
      'archived-cat': ['active-sub-2', 'archived-sub-2'],
    });
  });

  it('[] matches nothing (the service rejects it before reaching the repository)', async () => {
    expect(await tree([])).toEqual({});
  });
});
