import { Sequelize } from 'sequelize';
import { Card, initCardModel } from './card.js';
import { Expense, initExpenseModel } from './expense.js';
import { Income, initIncomeModel } from './income.js';
import {
  IncomeCategoryAllocation,
  initIncomeCategoryAllocationModel,
} from './income-category-allocation.js';
import {
  UserCategoryAllocationTemplate,
  initUserCategoryAllocationTemplateModel,
} from './category-allocation-template.js';
import { Category } from './category.js';

export const initModels = (sequelize: Sequelize) => {
  initExpenseModel(sequelize);
  initCardModel(sequelize);
  initIncomeModel(sequelize);
  initIncomeCategoryAllocationModel(sequelize);
  initUserCategoryAllocationTemplateModel(sequelize);

  Card.hasMany(Expense, {
    foreignKey: 'cardId',
    as: 'cards',
  });
  Expense.belongsTo(Card, { foreignKey: 'cardId' });

  UserCategoryAllocationTemplate.belongsTo(Category);
  Category.hasMany(UserCategoryAllocationTemplate);

  IncomeCategoryAllocation.belongsTo(Income);
  Income.hasMany(IncomeCategoryAllocation);

  IncomeCategoryAllocation.belongsTo(Category);
  Category.hasMany(IncomeCategoryAllocation);
};
