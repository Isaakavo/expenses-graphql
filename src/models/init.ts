import { Sequelize } from 'sequelize';
import { Card, initCardModel } from './card';
import { initExpenseModel, Expense } from './expense';
import { initIncomeModel, Income } from './income';
import { initPeriodModel, Period } from './period';

export const initModels = (sequelize: Sequelize) => {
  initExpenseModel(sequelize);
  initCardModel(sequelize);
  initIncomeModel(sequelize);
  initPeriodModel(sequelize);

  Card.hasMany(Expense, {
    foreignKey: 'cardId',
    as: 'cards',
  });
  Expense.belongsTo(Card, { foreignKey: 'cardId' });
  Income.belongsTo(Period, { foreignKey: 'periodId' });
  Period.hasMany(Income, { foreignKey: 'periodId' });
  Expense.belongsTo(Period, { foreignKey: 'periodId' });
  Period.hasMany(Expense, { foreignKey: 'periodId' });
};
