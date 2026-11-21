import { Card } from './card.js';
import {
  CategorySettings
} from './category-settings.js';
import { Category } from './category.js';
import { Expense } from './expense.js';
import { ExpenseRecurrence } from './expense-recurrence.js';
import {
  IncomeCategoryAllocation
} from './income-category-allocation.js';
import { Goal } from './goal.js';
import { GoalReimbursement } from './goal-reimbursement.js';
import { SavingsFund } from './savings-fund.js';
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

  Goal.belongsTo(SavingsFund, {
    foreignKey: 'fundId',
    as: 'fund',
  });
  Goal.belongsTo(Card, {
    foreignKey: 'defaultCardId',
    as: 'defaultCard',
    onDelete: 'SET NULL',
  });
  Goal.hasMany(GoalReimbursement, {
    foreignKey: 'goalId',
    as: 'reimbursements',
    onDelete: 'CASCADE',
  });

  ExpenseRecurrence.hasMany(Expense, {
    foreignKey: 'recurrenceId',
    as: 'expenses',
  });

  Income.associate();
  Expense.associate();
  Category.associate();
  Period.associate();
  SubCategory.associate();
  IncomeCategoryAllocation.associate();
  CategorySettings.associate();
}
