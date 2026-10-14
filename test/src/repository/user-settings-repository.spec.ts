import { Sequelize } from 'sequelize';
import { CurrencyCode } from '../../../src/generated/graphql.js';
import { initModels } from '../../../src/models/init-models.js';
import { UserSettings } from '../../../src/models/index.js';
import { UserSettingsRepository } from '../../../src/repository/user-settings-repository.js';
import { UserSettingsService } from '../../../src/service/user-settings-service.js';

const userA = '11111111-1111-4111-8111-111111111111';
const userB = '22222222-2222-4222-8222-222222222222';

beforeEach(async () => {
  const sequelize = new Sequelize('sqlite::memory:', { logging: false });
  initModels(sequelize);
  await sequelize.sync({ force: true });
});

describe('UserSettingsRepository', () => {
  it('defaults to USD when the user has no row', async () => {
    expect(await new UserSettingsRepository(userA).getDefaultCurrency()).toBe(
      CurrencyCode.USD
    );
    expect(await UserSettings.count()).toBe(0);
  });

  it('upserts the default currency for the same user', async () => {
    const repo = new UserSettingsRepository(userA);

    await repo.setDefaultCurrency(CurrencyCode.MXN);
    expect(await repo.getDefaultCurrency()).toBe(CurrencyCode.MXN);

    await repo.setDefaultCurrency(CurrencyCode.USD);
    expect(await repo.getDefaultCurrency()).toBe(CurrencyCode.USD);
    expect(await UserSettings.count()).toBe(1);
  });

  it('keeps settings isolated per user', async () => {
    await new UserSettingsRepository(userA).setDefaultCurrency(CurrencyCode.MXN);

    expect(await new UserSettingsRepository(userB).getDefaultCurrency()).toBe(
      CurrencyCode.USD
    );
  });
});

describe('UserSettingsService', () => {
  it('returns and updates the settings', async () => {
    const service = new UserSettingsService(userA);

    expect(await service.getSettings()).toEqual({
      defaultCurrency: CurrencyCode.USD,
    });
    expect(
      await service.updateSettings({ defaultCurrency: CurrencyCode.MXN })
    ).toEqual({ defaultCurrency: CurrencyCode.MXN });
    expect(await service.getSettings()).toEqual({
      defaultCurrency: CurrencyCode.MXN,
    });
  });
});
