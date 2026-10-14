import 'dotenv/config';
import { parseArgs } from 'node:util';
import { sequelizeClient } from '../database/client.js';
import { syncTables } from '../database/sync-database.js';
import { logger } from '../logger.js';
import { repriceForeignExpenses } from '../repository/foreign-expense-reprice.js';
import { ExchangeRateService } from '../service/exchange-rate-service.js';

const { values } = parseArgs({
  options: { from: { type: 'string' }, to: { type: 'string' } },
});

const isoDate = /^\d{4}-\d{2}-\d{2}$/;
const usage = 'Usage: pnpm rates:backfill --from YYYY-MM-DD [--to YYYY-MM-DD]';

const run = async () => {
  const service = new ExchangeRateService();
  const to = values.to ?? service.today();
  if (!values.from || !isoDate.test(values.from) || !isoDate.test(to) || values.from > to) {
    throw new Error(usage);
  }
  await syncTables(sequelizeClient);
  const total = await service.backfill(values.from, to);
  await repriceForeignExpenses(sequelizeClient);
  logger.info(`Backfill finished: ${total} rates cached from ${values.from} to ${to}`);
};

const closeConnection = () =>
  sequelizeClient.close().catch((error) => logger.error(`Closing the database failed: ${error.message}`));

run()
  .then(closeConnection)
  .catch(async (error) => {
    logger.error(`Backfill failed: ${error.message}`);
    await closeConnection();
    process.exit(1);
  });
