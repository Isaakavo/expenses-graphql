import { Sequelize } from 'sequelize';

export const sequelizeClient =
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
