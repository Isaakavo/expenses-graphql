import { MutationResolvers } from '../generated/graphql.js';
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
  createCategorySetting
} from './mutation/index.js';

//TODO add mutation for deletion
const mutations: MutationResolvers = {
  createIncome,
  updateIncome,
  deleteIncomeById,
  createExpense,
  createCategorySetting,
  // TODO add logic to handle weekly expenses
  createFixedExpense,
  updateExpense,
  deleteExpense,
  createCard,
  updateCard,
  deleteCard,
};

export default mutations;
