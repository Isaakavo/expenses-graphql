import { Sequelize, Transaction } from 'sequelize';
import { ExpenseDTO, RecurringSeriesDTO } from '../dto';
import {
  ExpenseRecurrence as GraphqlExpenseRecurrence,
  FixedExpenseFrequency,
  GoalRole,
  RecurrenceScope,
} from '../generated/graphql.js';
import { Expense } from '../models/index.js';
import { ExpenseRepository } from '../repository/expense-repository.js';
import { RecurrenceRepository } from '../repository/recurrence-repository.js';
import {
  inScope,
  isoDay,
  isPast,
  sequential,
  seriesDate,
  seriesDates,
} from '../utils/recurrence-utils.js';
import { validationError } from '../utils/validation-error.js';
import { ExpenseInput, ExpensesService, SeriesTemplate } from './expenses-service.js';

export type ExpenseUpdate = Partial<ExpenseInput> & { payBefore: Date };

export type RecurrenceUpdate = {
  id: string;
  frequency?: FixedExpenseFrequency | null;
  count?: number | null;
};

const templateOf = (expense: Expense): SeriesTemplate => ({
  concept: expense.concept,
  total: Number(expense.total),
  cardId: expense.cardId ?? undefined,
  comment: expense.comments ?? undefined,
  categoryId: '',
  subCategoryId: expense.subCategoryId,
  goalId: expense.goalId,
  goalRole: expense.goalRole as GoalRole | null,
  foreignAmount: expense.originalCurrency
    ? {
      amount: Number(expense.originalTotal),
      currency: expense.originalCurrency,
      fixedRate: expense.fixedRate,
    }
    : null,
});

export class RecurrenceService {
  private expenseRepository: ExpenseRepository;
  private recurrenceRepository: RecurrenceRepository;
  private expensesService: ExpensesService;
  private sequelize: Sequelize;
  private today: () => Date;

  constructor(userId: string, sequelize?: Sequelize, today: () => Date = () => new Date()) {
    this.expenseRepository = new ExpenseRepository(userId, sequelize);
    this.recurrenceRepository = new RecurrenceRepository(userId, sequelize);
    this.expensesService = new ExpensesService(userId, sequelize);
    this.sequelize = sequelize;
    this.today = today;
  }

  async getSeries(id: string): Promise<RecurringSeriesDTO | null> {
    const recurrence = await this.recurrenceRepository.findById(id);
    if (!recurrence) {
      return null;
    }
    return {
      id: recurrence.id,
      frequency: recurrence.frequency,
      expenses: await this.expenseRepository.getSeriesExpenses(id),
    };
  }

  async getPositions(
    expenseIds: readonly string[]
  ): Promise<(GraphqlExpenseRecurrence | null)[]> {
    const rows = await this.expenseRepository.getRecurrencePositions(expenseIds);
    const byExpense = new Map(rows.map((row) => [row.expenseId, row]));
    return expenseIds.map((expenseId) => {
      const row = byExpense.get(expenseId);
      return row
        ? { id: row.recurrenceId, frequency: row.frequency, position: row.position, count: row.count }
        : null;
    });
  }

  async updateExpense(
    id: string,
    input: ExpenseUpdate,
    scope: RecurrenceScope
  ): Promise<ExpenseDTO[]> {
    const selected = await this.requireExpense(id);
    if (scope === RecurrenceScope.THIS || !selected.recurrenceId) {
      return [await this.expensesService.updateExpense(id, input)];
    }

    const recurrence = await this.recurrenceRepository.findById(selected.recurrenceId);
    const series = await this.expenseRepository.getSeriesStates(selected.recurrenceId);
    const dateChanged = isoDay(input.payBefore) !== isoDay(selected.payBefore);
    const today = this.today();

    const dateFor = (target: Expense) => {
      if (target.id === selected.id) {
        return input.payBefore;
      }
      if (!dateChanged || isPast(target.payBefore, today)) {
        return target.payBefore;
      }
      return seriesDate(
        input.payBefore,
        recurrence.frequency,
        target.recurrenceIndex - selected.recurrenceIndex
      );
    };

    return this.sequelize.transaction((transaction) =>
      sequential(inScope(series, selected, scope), (target) =>
        this.expensesService.updateExpense(
          target.id,
          { ...input, payBefore: dateFor(target) },
          { transaction }
        )
      )
    );
  }

  async deleteExpense(id: string, scope: RecurrenceScope): Promise<number> {
    const selected = await this.requireExpense(id);
    if (!selected.recurrenceId) {
      await this.expensesService.deleteExpense(id);
      return 1;
    }

    const series = await this.expenseRepository.getSeriesStates(selected.recurrenceId);
    const targets = inScope(series, selected, scope);

    return this.sequelize.transaction(async (transaction) => {
      const deleted = await this.expenseRepository.deleteExpenses(
        targets.map((target) => target.id),
        { transaction }
      );
      if (targets.length === series.length) {
        await this.recurrenceRepository.delete(selected.recurrenceId, { transaction });
      }
      return deleted;
    });
  }

  async updateRecurrence({ id, frequency, count }: RecurrenceUpdate): Promise<RecurringSeriesDTO> {
    const recurrence = await this.recurrenceRepository.findById(id);
    if (!recurrence) {
      throw validationError('Recurrence not found', 'id');
    }
    const series = await this.expenseRepository.getSeriesStates(id);
    const today = this.today();
    const pastCount = series.filter((expense) => isPast(expense.payBefore, today)).length;
    const nextFrequency = frequency ?? recurrence.frequency;
    const targetCount = count ?? series.length;
    const minimum = Math.max(pastCount, 1);
    if (series.length === 0 || targetCount < minimum) {
      throw validationError(`count must be at least ${minimum}`, 'count');
    }

    const kept = series.slice(0, targetCount);
    const removed = series.slice(targetCount);
    const frequencyChanged = nextFrequency !== recurrence.frequency;
    const upcoming = kept.slice(pastCount);
    const redated = frequencyChanged && upcoming.length > 0
      ? seriesDates(upcoming[0].payBefore, nextFrequency, upcoming.length)
      : upcoming.map((expense) => expense.payBefore);
    const last = kept[kept.length - 1];
    const lastDate = redated.length > 0 ? redated[redated.length - 1] : last.payBefore;
    const planned = await this.expensesService.planSeries(
      templateOf(last),
      seriesDates(lastDate, nextFrequency, targetCount - kept.length, 1)
    );

    await this.sequelize.transaction(async (transaction) => {
      if (frequencyChanged) {
        await this.recurrenceRepository.updateFrequency(id, nextFrequency, { transaction });
        await this.redate(upcoming, redated, transaction);
      }
      if (removed.length > 0) {
        await this.expenseRepository.deleteExpenses(
          removed.map((expense) => expense.id),
          { transaction }
        );
      }
      if (planned.length > 0) {
        await this.expensesService.createSeriesExpenses(
          templateOf(last),
          planned,
          { recurrenceId: id, firstIndex: last.recurrenceIndex + 1 },
          transaction
        );
      }
    });

    return this.getSeries(id);
  }

  private async redate(expenses: Expense[], dates: Date[], transaction: Transaction) {
    const moves = expenses
      .map((expense, i) => ({ expense, payBefore: dates[i] }))
      .filter(({ expense, payBefore }) => isoDay(expense.payBefore) !== isoDay(payBefore));
    await sequential(moves, ({ expense, payBefore }) =>
      this.expensesService.updateExpense(expense.id, { payBefore }, { transaction })
    );
  }

  private async requireExpense(id: string) {
    const expense = await this.expenseRepository.getExpenseState(id);
    if (!expense) {
      throw new Error('Expense id not found');
    }
    return expense;
  }
}
