import { Sequelize } from 'sequelize';
import { initCardModel } from './card.js';
import {
  initUserCategoryAllocationTemplateModel
} from './category-settings.js';
import { initCategoryModel } from './category.js';
import { initExpenseModel } from './expense.js';
import {
  initIncomeCategoryAllocationModel
} from './income-category-allocation.js';
import { initIncomeModel } from './income.js';
import { initPeriodsModel } from './periods.js';
import { initSubCategoryModel } from './sub-category.js';
import {initInvestmentRecordModel} from './investment-record.js';

export const initModels = (sequelize: Sequelize) => {
  initExpenseModel(sequelize);
  initCardModel(sequelize);
  initIncomeModel(sequelize);
  initCategoryModel(sequelize);
  initSubCategoryModel(sequelize);
  initIncomeCategoryAllocationModel(sequelize);
  initUserCategoryAllocationTemplateModel(sequelize);
  initPeriodsModel(sequelize);
  initInvestmentRecordModel(sequelize);
};
