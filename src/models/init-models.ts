import { Sequelize } from 'sequelize';
import { Card, initCardModel } from './card';
import { Expense, initExpenseModel } from './expense';
import { initIncomeModel } from './income';

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
