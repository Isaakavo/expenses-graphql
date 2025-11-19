import {MutationResolvers} from '../generated/graphql.js';
import {
  createCard,
  createExpense,
  createFixedExpense,
  createIncome,
  deleteCard,
  deleteExpense,
  deleteIncomeById,
  updateCard,
  updateExpense,
  updateIncome,
  createCategorySetting,
  deleteCategorySetting, updateCategorySetting,
} from './mutation/index.js';

//TODO add mutation for deletion
const mutations: MutationResolvers = {
  createIncome,
  updateIncome,
  deleteIncomeById,
  createExpense,
  createCategorySetting,
  updateCategorySetting,
  // TODO add logic to handle weekly expenses
  createFixedExpense,
  updateExpense,
  deleteExpense,
  createCard,
  updateCard,
  deleteCard,
  deleteCategorySetting,
};

export default mutations;
