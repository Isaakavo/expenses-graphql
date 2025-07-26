import { initModels } from 'models/init';
import { Sequelize } from 'sequelize';
// import { Expense, Income, Period } from 'models';

export const testSequelize = new Sequelize({
  dialect: 'sqlite',
  storage: ':memory:',
  logging: false,
  // models: [Income, Expense, Period],
});

export const connectDatabase = async () => {
  try {
    initModels(testSequelize);

    await testSequelize.authenticate();
    await testSequelize.sync({ force: true });
  } catch (error) {
    console.error(`Error connecting to database ${error.message}`);
  }
};
