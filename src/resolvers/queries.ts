import {
  QueryResolvers
} from '../generated/graphql.js';
import {
  allExpenses,
  allExpensesByDateRange,
  cardById,
  cardList,
  expenseById,
  expensesByFortnight,
  expensesByMonth,
  expensesTotalByCardId,
  financialBalanceByFortnight,
  incomeById,
  incomesAndExpensesByFortnight,
  incomesByMonth,
  incomesList,
  login
} from './query/index.js';

const queries: QueryResolvers = {
  allExpenses,
  allExpensesByDateRange,
  expensesByFortnight,
  expensesByMonth,
  expenseById,
  incomesAndExpensesByFortnight,
  // TODO add logic to return a new field called creditCardDebts
  // if the expense contains tag "tarjeta de credito" those totals should be added
  // to this new field.
  financialBalanceByFortnight,
  incomesList,
  incomeById,
  incomesByMonth,
  cardList,
  cardById,
  expensesTotalByCardId,
  login
};

export default queries;
