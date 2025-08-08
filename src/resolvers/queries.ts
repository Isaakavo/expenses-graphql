import {
  QueryResolvers
} from '../generated/graphql.js';
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
  categorySettings
} from './query/index.js';

const queries: QueryResolvers = {
  allExpenses,
  expenseById,
  financialBalanceByFortnight,
  incomesList,
  incomeById,
  cardList,
  cardById,
  login,
  incomesWithExpenses,
  categorySettings
};

export default queries;
