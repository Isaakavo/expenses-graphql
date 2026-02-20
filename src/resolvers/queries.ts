import { QueryResolvers } from '../generated/graphql.js';
import { withErrorHandling } from '../utils/resolver-wrapper.js';
import {
  allExpenses,
  cardById,
  cardList,
  expenseById,
  financialBalanceByFortnight,
  incomeById,
  incomesList,
  login,
  incomesWithExpenses,
  categorySettings,
  incomesGroupedBy,
  categoryAllocation,
  categoryList,
  periodsList,
  period,
  allInvestmentRecords,
  investmentDetails,
  udiValue,
} from './query/index.js';

const queries: QueryResolvers = {
  allExpenses: withErrorHandling('allExpenses', allExpenses),
  expenseById: withErrorHandling('expenseById', expenseById),
  financialBalanceByFortnight: withErrorHandling('financialBalanceByFortnight', financialBalanceByFortnight),
  incomesGroupedBy: withErrorHandling('incomesGroupedBy', incomesGroupedBy),
  incomesList: withErrorHandling('incomesList', incomesList),
  incomeById: withErrorHandling('incomeById', incomeById),
  cardList: withErrorHandling('cardList', cardList),
  cardById: withErrorHandling('cardById', cardById),
  login: withErrorHandling('login', login),
  incomesWithExpenses: withErrorHandling('incomesWithExpenses', incomesWithExpenses),
  categorySettings: withErrorHandling('categorySettings', categorySettings),
  categoryAllocation: withErrorHandling('categoryAllocation', categoryAllocation),
  categoryList: withErrorHandling('categoryList', categoryList),
  periodsList: withErrorHandling('periodsList', periodsList),
  period: withErrorHandling('period', period),
  allInvestmentRecords: withErrorHandling('allInvestmentRecords', allInvestmentRecords),
  investmentDetails: withErrorHandling('investmentDetails', investmentDetails),
  udiValue: withErrorHandling('udiValue', udiValue),
};

export default queries;
