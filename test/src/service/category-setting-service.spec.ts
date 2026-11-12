import { describe, it, expect, beforeEach, vi } from 'vitest';
import { Sequelize } from 'sequelize';
import { CategorySettingsService } from '../../../src/service/category-setting-service.js';
import { CategorySettingsRepository } from '../../../src/repository/category-settings-repository.js';

const userId = 'test-user';
let sequelize: Sequelize;
let service: CategorySettingsService;
let mockRepo: CategorySettingsRepository;

type SettingRow = Awaited<ReturnType<CategorySettingsRepository['getCategorySettings']>>[number];
const settingRow = (row: object) => row as SettingRow;
type CreatedRow = Awaited<ReturnType<CategorySettingsRepository['createCategorySetting']>>;
const createdRow = (row: object) => row as unknown as CreatedRow;

beforeEach(() => {
  sequelize = new Sequelize('sqlite::memory:', { logging: false });
  mockRepo = {
    getCategorySettings: vi.fn(),
    createCategorySetting: vi.fn(),
    updateCategorySetting: vi.fn(),
  } as unknown as CategorySettingsRepository;
  service = new CategorySettingsService(userId, sequelize);
  service.categorySettingsRepository = mockRepo;
});

describe('CategorySettingsService', () => {
  it('returns category settings from repository', async () => {
    vi.mocked(mockRepo.getCategorySettings).mockResolvedValue([
      settingRow({
        id: '1',
        userId,
        categoryId: 'cat1',
        percentage: 0.5,
        category: { name: 'Cat 1' },
      }),
    ]);
    const result = await service.getCategorySettings();
    expect(result).toHaveLength(1);
    expect(result[0].categoryId).toBe('cat1');
  });

  it('throws error if total percentage exceeds 100%', async () => {
    vi.mocked(mockRepo.getCategorySettings).mockResolvedValue([
      settingRow({
        id: '1',
        userId,
        categoryId: 'cat1',
        percentage: 0.7,
        category: { name: 'Cat 1' },
      }),
    ]);
    await expect(
      service.createCategorySetting({ categoryId: 'cat2', percentage: 0.4 })
    ).rejects.toThrow('Total percentage exceeds 100%');
  });

  it('calls repository to create category setting if valid', async () => {
    vi.mocked(mockRepo.getCategorySettings).mockResolvedValue([
      settingRow({
        id: '1',
        userId,
        categoryId: 'cat1',
        percentage: 0.5,
        category: { name: 'Cat 1' },
      }),
    ]);
    vi.mocked(mockRepo.createCategorySetting).mockResolvedValue(createdRow({
      id: '2',
      userId,
      categoryId: 'cat2',
      percentage: 0.4,
      category: { name: 'Cat 2' },
    }));
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
    vi.mocked(mockRepo.getCategorySettings).mockResolvedValue([]);
    vi.mocked(mockRepo.createCategorySetting).mockRejectedValue(
      new Error('Duplicate key')
    );
    await expect(
      service.createCategorySetting({ categoryId: 'cat1', percentage: 0.5 })
    ).rejects.toThrow('Duplicate key');
  });

  describe('updateCategorySetting', () => {
    const fullBudget = [
      settingRow({ id: 'household', percentage: '0.60' }),
      settingRow({ id: 'communication', percentage: '0.04' }),
      settingRow({ id: 'health', percentage: '0.01' }),
      settingRow({ id: 'lifestyle', percentage: '0.05' }),
      settingRow({ id: 'food', percentage: '0.10' }),
      settingRow({ id: 'education', percentage: '0.02' }),
      settingRow({ id: 'others', percentage: '0.03' }),
      settingRow({ id: 'financial', percentage: '0.15' }),
    ];

    beforeEach(() => {
      vi.mocked(mockRepo.getCategorySettings).mockResolvedValue(fullBudget);
    });

    it('lets a user at 100% lower a setting', async () => {
      await service.updateCategorySetting({ id: 'lifestyle', percentage: 0.03 });

      expect(mockRepo.updateCategorySetting).toHaveBeenCalledWith('lifestyle', 0.03);
    });

    it('lets a user at 100% save a setting with the same value', async () => {
      await service.updateCategorySetting({ id: 'household', percentage: 0.6 });

      expect(mockRepo.updateCategorySetting).toHaveBeenCalledWith('household', 0.6);
    });

    it('rejects raising a setting past 100%', async () => {
      await expect(service.updateCategorySetting({ id: 'lifestyle', percentage: 0.06 })).rejects.toThrow(
        'Total percentage exceeds 100%'
      );
      expect(mockRepo.updateCategorySetting).not.toHaveBeenCalled();
    });
  });

  it('accepts a new setting that brings the total to exactly 100%', async () => {
    vi.mocked(mockRepo.getCategorySettings).mockResolvedValue([
      settingRow({ id: '1', percentage: 0.7 }),
      settingRow({ id: '2', percentage: 0.1 }),
    ]);

    await service.createCategorySetting({ categoryId: 'cat3', percentage: 0.2 });

    expect(mockRepo.createCategorySetting).toHaveBeenCalled();
  });
});
