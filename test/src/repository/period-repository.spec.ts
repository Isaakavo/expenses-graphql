import { sequelize as databaseSequelize } from 'database';
import { Sequelize } from 'sequelize';
import { initPeriodsModel } from 'models/periods.js';
import { Period } from 'models/periods';
import { PeriodRepository } from 'repository/period-repository.js';

let sequelize: Sequelize;
let periodRepository: PeriodRepository;

beforeEach(async () => {
  sequelize = new Sequelize('sqlite::memory:', { logging: false });
  initPeriodsModel(sequelize);
  await sequelize.sync({ force: true });
  periodRepository = new PeriodRepository('123');
});

describe('Period Model', () => {
  it('Inserts a new period if not exists', async () => {
    const period = await periodRepository.createPeriod(new Date('2025-08-08'));
    expect(period).toBeDefined();
    expect(period.startDate.toISOString()).toBe('2025-08-08T00:00:00.000Z');
    expect(period.endDate.toISOString()).toBe('2025-08-21T00:00:00.000Z');
    const count = await Period.count();
    expect(count).toBe(1);
  });

  it('Inserts new periods with correct fortnightly dates', async () => {
    const period2 = await periodRepository.createPeriod(new Date('2025-07-25'));
    expect(period2).toBeDefined();
    expect(period2.startDate.toISOString()).toBe('2025-07-25T00:00:00.000Z');
    expect(period2.endDate.toISOString()).toBe('2025-08-07T00:00:00.000Z');

    const period = await periodRepository.createPeriod(new Date('2025-08-08'));
    expect(period).toBeDefined();
    expect(period.startDate.toISOString()).toBe('2025-08-08T00:00:00.000Z');
    expect(period.endDate.toISOString()).toBe('2025-08-21T00:00:00.000Z');

    const count = await Period.count();
    expect(count).toBe(2);
  });

  it('If a period exists for that type and range, it is overwritten only if the end is greater', async () => {
    // Insert original period
    await periodRepository.createPeriod(new Date('2025-08-08'));
    // Intentar "expandir" el rango
    const updated = await periodRepository.createPeriod(new Date('2025-08-09'));
    const count = await Period.count();

    expect(updated.startDate.toISOString()).toBe('2025-08-09T00:00:00.000Z');
    expect(updated.endDate.toISOString()).toBe('2025-08-22T00:00:00.000Z');
    expect(count).toBe(1);
    // Ahora intenta acortar el periodo (NO debe actualizar)
    const notUpdated = await periodRepository.createPeriod(
      new Date('2025-08-09')
    );
    expect(notUpdated.endDate.toISOString()).toBe('2025-08-22T00:00:00.000Z'); // No cambia
    expect(await Period.count()).toBe(1);
  });

  it('If a record is removed', async () => {
    const period1 = await periodRepository.createPeriod(
      new Date('2025-08-08'),
    );
    const period2 = await periodRepository.createPeriod(
      new Date('2025-09-08'),
    );
    await period1.destroy();
    const periods = await Period.findAll();
    expect(periods.length).toBe(1);
    expect(periods[0].id).toBe(period2.id);
  });
});
