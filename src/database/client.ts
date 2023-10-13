import { Sequelize } from 'sequelize';

export const sequelize = new Sequelize({
  dialect: 'postgres',
  host: 'localhost',
  port: 5432,
  username: 'root',
  password: 'admin',
  database: 'expenses',
  logging: false
});

export const connectDatabase = async () => {
  try {
    await sequelize.authenticate();
    console.log('Connected to database');
  } catch (error) {
    console.error('Error connecting to database ', error);
  }
};
