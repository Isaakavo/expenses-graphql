import { RecurringSeriesDTO } from '../dto';
import { RecurringSeries } from '../generated/graphql.js';
import { adaptExpensesDTOInput } from './income-adapter.js';

export const adaptRecurringSeries = (series: RecurringSeriesDTO): RecurringSeries => ({
  id: series.id,
  frequency: series.frequency,
  expenses: series.expenses.map((expense) => adaptExpensesDTOInput(expense)),
});
