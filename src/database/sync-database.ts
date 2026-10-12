import { associateModels } from '../models/associations.js';
import { Sequelize } from 'sequelize';
import { logger } from '../logger.js';
import { initModels } from '../models/init-models.js';

export const syncTables = async (sequelize: Sequelize) => {
  try {
    logger.info('Starting data base connection...');
    await sequelize.authenticate();
    initModels(sequelize);
    associateModels();
    // In production the schema is managed exclusively by the SQL migrations in
    // /migrations (run via the fly.io release_command). Running sync() there
    // causes schema drift, so it is limited to non-production environments.
    if (process.env.NODE_ENV !== 'production') {
      // await sequelize.sync({ force: true });
      await sequelize.sync();
    }
    logger.info('Synced tables', 'syncTables');
  } catch (error) {
    logger.error('Failed to sync tables', error);
    // Re-throw so the caller can abort startup: a process that cannot reach
    // its database must exit non-zero rather than serve requests without a DB.
    throw error;
  }
};
