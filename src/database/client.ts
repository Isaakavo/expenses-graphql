import { Sequelize } from 'sequelize';

export const sequilize = new Sequelize({
  dialect: 'postgres',
  host: 'localhost',
  port: 5432,
  username: 'root',
  password: 'admin',
  database: 'expenses',
});

export const connectDatabase = async () => {
  try {
    await sequilize.authenticate();
    console.log('Connected to database');
  } catch (error) {
    console.error('Error connecting to database ', error);
  }
};
