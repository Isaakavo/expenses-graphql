import { Sequelize } from 'sequelize';
import { Card, initCardModel } from './card.js';
import { Expense, initExpenseModel } from './expense.js';
import { initIncomeModel } from './income.js';

export const initModels = (sequelize: Sequelize) => {
  initExpenseModel(sequelize);
  initCardModel(sequelize);
  initIncomeModel(sequelize);

  Card.hasMany(Expense, {
    foreignKey: 'cardId',
    as: 'cards',
  });
  Expense.belongsTo(Card, { foreignKey: 'cardId' });
};
