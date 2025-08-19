import { QueryResolvers } from '../generated/graphql.js';
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
  categoryAllocation
} from './query/index.js';

const queries: QueryResolvers = {
  allExpenses,
  expenseById,
  financialBalanceByFortnight,
  incomesGroupedBy,
  incomesList,
  incomeById,
  cardList,
  cardById,
  login,
  incomesWithExpenses,
  categorySettings,
  categoryAllocation
};

export default queries;
