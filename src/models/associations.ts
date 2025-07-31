import { Card } from './card.js';
import {
  UserCategoryAllocationTemplate
} from './category-allocation-template.js';
import { Category } from './category.js';
import { Expense } from './expense.js';
import {
  IncomeCategoryAllocation
} from './income-category-allocation.js';
import { Income } from './income.js';
import { Period } from './periods.js';
import { SubCategory } from './sub-category.js';


export const associateModels = () => {
  Card.hasMany(Expense, {
    foreignKey: 'cardId',
    as: 'expenses',
  });

  Income.associate();
  Expense.associate();
  Category.associate();
  Period.associate();
  SubCategory.associate();
  IncomeCategoryAllocation.associate();
  UserCategoryAllocationTemplate.associate();
}
