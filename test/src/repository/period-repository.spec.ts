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
  periodRepository = new PeriodRepository('123', sequelize);
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

  it('Returns the existing period when the date falls inside it', async () => {
    const original = await periodRepository.createPeriod(new Date('2025-08-08'));
    const sameRange = await periodRepository.createPeriod(new Date('2025-08-09'));

    expect(sameRange.id).toBe(original.id);
    expect(sameRange.startDate.toISOString()).toBe('2025-08-08T00:00:00.000Z');
    expect(sameRange.endDate.toISOString()).toBe('2025-08-21T00:00:00.000Z');
    expect(await Period.count()).toBe(1);
  });

  it('Fills the gap up to the new date with consecutive fortnightly periods', async () => {
    await periodRepository.createPeriod(new Date('2025-08-08'));
    const latest = await periodRepository.createPeriod(new Date('2025-09-08'));

    expect(latest.startDate.toISOString()).toBe('2025-09-05T00:00:00.000Z');
    expect(latest.endDate.toISOString()).toBe('2025-09-18T00:00:00.000Z');

    const periods = await Period.findAll({ order: [['startDate', 'ASC']] });
    expect(
      periods.map((p) => [p.startDate.toISOString(), p.endDate.toISOString()])
    ).toEqual([
      ['2025-08-08T00:00:00.000Z', '2025-08-21T00:00:00.000Z'],
      ['2025-08-22T00:00:00.000Z', '2025-09-04T00:00:00.000Z'],
      ['2025-09-05T00:00:00.000Z', '2025-09-18T00:00:00.000Z'],
    ]);
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
    expect(periods.length).toBe(2);
    expect(periods.map((p) => p.id)).not.toContain(period1.id);
    expect(periods.map((p) => p.id)).toContain(period2.id);
  });
});
