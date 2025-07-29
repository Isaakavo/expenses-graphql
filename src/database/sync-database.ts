import { initModels } from '../models/init-models.js';
import { logger } from '../logger.js';
import { Sequelize } from 'sequelize';

export const syncTables = async (sequelize: Sequelize) => {
  try {
    logger.info('Starting data base connection...');
    await sequelize.authenticate();
    initModels(sequelize);
    // await sequelize.sync({ force: true });
    await sequelize.sync();
    logger.info('Synced tables', 'syncTables');
  } catch (error) {
    logger.error('Failed to sync tables', error);
  }
};
