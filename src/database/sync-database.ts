import { initModels } from 'models/init-models.js';
import { logger } from '../logger.js';
import { sequelize } from './client.js';

export const syncTables = async () => {
  try {
    initModels(sequelize);

    // await sequelize.sync({ force: true });
    await sequelize.sync();
    logger.info('Synced tables', 'syncTables');
  } catch (error) {
    logger.error('Failed to sync tables', error);
  }
};
