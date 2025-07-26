import { Sequelize } from 'sequelize';
// import { Expense, Income, Period } from 'models';

export const testSequelize = new Sequelize({
  dialect: 'sqlite',
  storage: ':memory:',
  logging: false,
  // models: [Income, Expense, Period],
});
