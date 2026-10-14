import { Op } from 'sequelize';
import { ExchangeRate } from '../models/exchange-rate.js';

export type ExchangeRateRow = {
  base: string;
  quote: string;
  rateDate: string;
  rate: number;
  source: string;
};

const toRow = (model: ExchangeRate): ExchangeRateRow => ({
  base: model.base,
  quote: model.quote,
  rateDate: model.rateDate,
  rate: Number(model.rate),
  source: model.source,
});

export class ExchangeRateRepository {
  async findLatestOnOrBefore(
    base: string,
    quote: string,
    date: string
  ): Promise<ExchangeRateRow | null> {
    const model = await ExchangeRate.findOne({
      where: { base, quote, rateDate: { [Op.lte]: date } },
      order: [['rateDate', 'DESC']],
    });
    return model ? toRow(model) : null;
  }

  async findEarliestDate(base: string, quote: string): Promise<string | null> {
    const model = await ExchangeRate.findOne({
      where: { base, quote },
      order: [['rateDate', 'ASC']],
    });
    return model?.rateDate ?? null;
  }

  async findBetween(
    base: string,
    quote: string,
    startDate: string,
    endDate: string
  ): Promise<ExchangeRateRow[]> {
    const models = await ExchangeRate.findAll({
      where: { base, quote, rateDate: { [Op.between]: [startDate, endDate] } },
      order: [['rateDate', 'ASC']],
    });
    return models.map(toRow);
  }

  async upsertMany(rows: ExchangeRateRow[]): Promise<void> {
    const fetchedAt = new Date();
    await ExchangeRate.bulkCreate(
      rows.map((row) => ({ ...row, fetchedAt })),
      { updateOnDuplicate: ['rate', 'source', 'fetchedAt'] }
    );
  }
}
