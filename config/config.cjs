'use strict';

// sequelize-cli config. Values are resolved from environment variables at
// runtime so the same file works locally and in production. In production the
// connection string comes from DATABASE_URL (the same variable used by
// src/database/client.ts), while development/test mirror the DB_* variables
// used by the app's non-production Sequelize client.
require('dotenv').config();

const nonProduction = {
  username: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || 'admin',
  database: process.env.DB_NAME || 'expenses',
  host: process.env.DB_HOST || '127.0.0.1',
  port: process.env.DB_PORT ? Number(process.env.DB_PORT) : 5432,
  dialect: 'postgres',
};

module.exports = {
  development: { ...nonProduction },
  test: { ...nonProduction, password: process.env.DB_PASSWORD || null },
  production: {
    use_env_variable: 'DATABASE_URL',
    dialect: 'postgres',
    logging: false,
  },
};
