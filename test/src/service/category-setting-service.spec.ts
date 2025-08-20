import { describe, it, expect, beforeEach, vi } from 'vitest';
import { Sequelize } from 'sequelize';
import { CategorySettingsService } from '../../../src/service/category-setting-service.js';
import { CategorySettingsRepository } from '../../../src/repository/category-settings-repository.js';

const userId = 'test-user';
let sequelize: Sequelize;
let service: CategorySettingsService;
let mockRepo: CategorySettingsRepository;

beforeEach(() => {
  sequelize = new Sequelize('sqlite::memory:', { logging: false });
  mockRepo = {
    getCategorySettings: vi.fn(),
    createCategorySetting: vi.fn(),
  } as unknown as CategorySettingsRepository;
  service = new CategorySettingsService(userId, sequelize);
  service.categorySettingsRepository = mockRepo;
});

describe('CategorySettingsService', () => {
  it('returns category settings from repository', async () => {
    (mockRepo.getCategorySettings as any).mockResolvedValue([
      {
        id: '1',
        userId,
        categoryId: 'cat1',
        percentage: 0.5,
        category: { name: 'Cat 1' },
      },
    ]);
    const result = await service.getCategorySettings();
    expect(result).toHaveLength(1);
    expect(result[0].categoryId).toBe('cat1');
  });

  it('throws error if total percentage exceeds 100%', async () => {
    (mockRepo.getCategorySettings as any).mockResolvedValue([
      {
        id: '1',
        userId,
        categoryId: 'cat1',
        percentage: 0.7,
        category: { name: 'Cat 1' },
      },
    ]);
    await expect(
      service.createCategorySetting({ categoryId: 'cat2', percentage: 0.4 })
    ).rejects.toThrow('Total percentage exceeds 100%');
  });

  it('calls repository to create category setting if valid', async () => {
    (mockRepo.getCategorySettings as any).mockResolvedValue([
      {
        id: '1',
        userId,
        categoryId: 'cat1',
        percentage: 0.5,
        category: { name: 'Cat 1' },
      },
    ]);
    (mockRepo.createCategorySetting as any).mockResolvedValue({
      id: '2',
      userId,
      categoryId: 'cat2',
      percentage: 0.4,
      category: { name: 'Cat 2' },
    });
    const result = await service.createCategorySetting({
      categoryId: 'cat2',
      percentage: 0.4,
    });
    expect(mockRepo.createCategorySetting).toHaveBeenCalledWith({
      userId,
      categoryId: 'cat2',
      percentage: 0.4,
    });
    expect(result.categoryId).toBe('cat2');
  });

  it('propagates repository errors', async () => {
    (mockRepo.getCategorySettings as any).mockResolvedValue([]);
    (mockRepo.createCategorySetting as any).mockRejectedValue(
      new Error('Duplicate key')
    );
    await expect(
      service.createCategorySetting({ categoryId: 'cat1', percentage: 0.5 })
    ).rejects.toThrow('Duplicate key');
  });
});
