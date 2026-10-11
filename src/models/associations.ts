import { Card } from './card.js';
import {
  CategorySettings
} from './category-settings.js';
import { Category } from './category.js';
import { Expense } from './expense.js';
import {
  IncomeCategoryAllocation
} from './income-category-allocation.js';
import { Goal } from './goal.js';
import { Income } from './income.js';
import { Period } from './periods.js';
import { SubCategory } from './sub-category.js';


export const associateModels = () => {
  Card.hasMany(Expense, {
    foreignKey: 'cardId',
    as: 'expenses',
  });

  Goal.hasMany(Expense, {
    foreignKey: 'goalId',
    as: 'expenses',
  });
  Expense.belongsTo(Goal, {
    foreignKey: 'goalId',
    as: 'goal',
  });

  Income.associate();
  Expense.associate();
  Category.associate();
  Period.associate();
  SubCategory.associate();
  IncomeCategoryAllocation.associate();
  CategorySettings.associate();
}
