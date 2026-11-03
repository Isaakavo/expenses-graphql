import { FixedExpenseFrequency } from '../generated/graphql.js';
import { ExpenseDTO } from './expense-dto.js';

export type RecurrencePositionDTO = {
  expenseId: string;
  recurrenceId: string;
  frequency: FixedExpenseFrequency;
  position: number;
  count: number;
};

export type RecurringSeriesDTO = {
  id: string;
  frequency: FixedExpenseFrequency;
  expenses: ExpenseDTO[];
};
