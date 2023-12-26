import { Sequelize } from 'sequelize';
import { logger } from '../logger.js';

export const sequelize =
  process.env.NODE_ENV === 'production'
    ? new Sequelize(process.env.DATABASE_URL, {
      logging: false,
    })
    : new Sequelize({
      dialect: 'postgres',
      host: 'localhost',
      port: 5432,
      username: 'root',
      password: 'admin',
      database: 'expenses',
      logging: false,
    });

export const connectDatabase = async () => {
  try {
    await sequelize.authenticate();
    logger.info('Connected to database');
  } catch (error) {
    logger.error(`Error connecting to database ${error.message}`);
  }
};
