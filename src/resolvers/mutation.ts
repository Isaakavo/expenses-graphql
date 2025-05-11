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
} from './mutations/index.js';

//TODO add mutation for deletion
const mutations: MutationResolvers = {
  createIncome,
  updateIncome,
  deleteIncomeById,
  createExpense,
  // TODO add logic to handle weekly expenses
  createFixedExpense,
  updateExpense,
  deleteExpense,
  createCard,
  updateCard,
  deleteCard,
};

export default mutations;
