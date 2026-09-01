import {MutationResolvers} from '../generated/graphql.js';
import { withErrorHandling } from '../utils/resolver-wrapper.js';
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
  deleteCategorySetting,
  updateCategorySetting,
  updateCategoryAllocation,
  createInvestmentRecord,
  createProviderLinkToken,
  linkCardToProvider,
  unlinkCardFromProvider,
  syncTransactions,
} from './mutation/index.js';

//TODO add mutation for deletion
const mutations: MutationResolvers = {
  createIncome: withErrorHandling('createIncome', createIncome),
  updateIncome: withErrorHandling('updateIncome', updateIncome),
  deleteIncomeById: withErrorHandling('deleteIncomeById', deleteIncomeById),
  createExpense: withErrorHandling('createExpense', createExpense),
  createCategorySetting: withErrorHandling('createCategorySetting', createCategorySetting),
  updateCategorySetting: withErrorHandling('updateCategorySetting', updateCategorySetting),
  // TODO add logic to handle weekly expenses
  createFixedExpense: withErrorHandling('createFixedExpense', createFixedExpense),
  updateExpense: withErrorHandling('updateExpense', updateExpense),
  deleteExpense: withErrorHandling('deleteExpense', deleteExpense),
  createCard: withErrorHandling('createCard', createCard),
  updateCard: withErrorHandling('updateCard', updateCard),
  deleteCard: withErrorHandling('deleteCard', deleteCard),
  deleteCategorySetting: withErrorHandling('deleteCategorySetting', deleteCategorySetting),
  updateCategoryAllocation: withErrorHandling('updateCategoryAllocation', updateCategoryAllocation),
  createInvestmentRecord: withErrorHandling('createInvestmentRecord', createInvestmentRecord),
  createProviderLinkToken: withErrorHandling('createProviderLinkToken', createProviderLinkToken),
  linkCardToProvider: withErrorHandling('linkCardToProvider', linkCardToProvider),
  unlinkCardFromProvider: withErrorHandling('unlinkCardFromProvider', unlinkCardFromProvider),
  syncTransactions: withErrorHandling('syncTransactions', syncTransactions),
};

export default mutations;
