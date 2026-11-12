import { Sequelize, Transaction } from 'sequelize';
import { ExpenseDTO, RecurringSeriesDTO } from '../dto';
import {
  ExpenseRecurrence as GraphqlExpenseRecurrence,
  FixedExpenseFrequency,
  GoalRole,
  RecurrenceScope,
} from '../generated/graphql.js';
import { Expense, ExpenseRecurrence } from '../models/index.js';
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
import { conflictError } from '../utils/conflict-error.js';
import { validationError } from '../utils/validation-error.js';
import {
  assertRepetitions,
  ExpenseInput,
  ExpensesService,
  SeriesTemplate,
  UpdatePlan,
} from './expenses-service.js';

export type ExpenseUpdate = Partial<ExpenseInput> & { payBefore: Date };

export type RecurrenceUpdate = {
  id: string;
  frequency?: FixedExpenseFrequency | null;
  count?: number | null;
};

const versionOf = ({ recurrence, series }: { recurrence: ExpenseRecurrence; series: Expense[] }) =>
  [
    recurrence.frequency,
    ...series.map((expense) => `${expense.id}:${expense.recurrenceIndex}:${expense.updatedAt?.getTime()}`),
  ].join(',');

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

    const plans = await sequential(inScope(series, selected, scope), (target) =>
      this.expensesService.planUpdate(target.id, { ...input, payBefore: dateFor(target) })
    );

    return this.sequelize.transaction(async (transaction) => {
      await this.lockUnchanged({ recurrence, series }, transaction);
      return sequential(plans, (plan) => this.expensesService.applyUpdate(plan, transaction));
    });
  }

  async deleteExpense(id: string, scope: RecurrenceScope): Promise<number> {
    const selected = await this.requireExpense(id);
    if (!selected.recurrenceId) {
      await this.expensesService.deleteExpense(id);
      return 1;
    }

    return this.sequelize.transaction(async (transaction) => {
      const { series } = await this.lockSeries(selected.recurrenceId, transaction);
      const targets = inScope(series, selected, scope);
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
    const past = series.filter((expense) => isPast(expense.payBefore, today));
    const upcoming = series.filter((expense) => !isPast(expense.payBefore, today));
    const nextFrequency = frequency ?? recurrence.frequency;
    const targetCount = count ?? series.length;
    if (count != null) assertRepetitions(count, 'count');
    const minimum = Math.max(past.length, 1);
    if (series.length === 0 || targetCount < minimum) {
      throw validationError(`count must be at least ${minimum}`, 'count');
    }

    const keptUpcoming = upcoming.slice(0, targetCount - past.length);
    const removed = upcoming.slice(targetCount - past.length);
    const frequencyChanged = nextFrequency !== recurrence.frequency;
    const redated = frequencyChanged && keptUpcoming.length > 0
      ? seriesDates(keptUpcoming[0].payBefore, nextFrequency, keptUpcoming.length)
      : keptUpcoming.map((expense) => expense.payBefore);
    const kept = [...past, ...keptUpcoming];
    const last = kept.reduce((latest, expense) =>
      expense.recurrenceIndex > latest.recurrenceIndex ? expense : latest
    );
    const lastDate = [...past.map((expense) => expense.payBefore), ...redated]
      .reduce((latest, date) => (date > latest ? date : latest));
    const moves = await this.planMoves(keptUpcoming, redated);
    const planned = await this.expensesService.planSeries(
      templateOf(last),
      seriesDates(lastDate, nextFrequency, targetCount - kept.length, 1)
    );

    await this.sequelize.transaction(async (transaction) => {
      await this.lockUnchanged({ recurrence, series }, transaction);
      if (frequencyChanged) {
        await this.recurrenceRepository.updateFrequency(id, nextFrequency, { transaction });
        await sequential(moves, (plan) => this.expensesService.applyUpdate(plan, transaction));
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

  private async planMoves(expenses: Expense[], dates: Date[]): Promise<UpdatePlan[]> {
    const moves = expenses
      .map((expense, i) => ({ expense, payBefore: dates[i] }))
      .filter(({ expense, payBefore }) => isoDay(expense.payBefore) !== isoDay(payBefore));
    return sequential(moves, ({ expense, payBefore }) =>
      this.expensesService.planUpdate(expense.id, { payBefore })
    );
  }

  private async lockSeries(recurrenceId: string, transaction: Transaction) {
    const recurrence = await this.recurrenceRepository.findById(recurrenceId, {
      transaction,
      lock: true,
    });
    if (!recurrence) {
      throw conflictError('The series changed, try again');
    }
    return {
      recurrence,
      series: await this.expenseRepository.getSeriesStates(recurrenceId, { transaction }),
    };
  }

  private async lockUnchanged(
    read: { recurrence: ExpenseRecurrence; series: Expense[] },
    transaction: Transaction
  ) {
    const locked = await this.lockSeries(read.recurrence.id, transaction);
    if (versionOf(locked) !== versionOf(read)) {
      throw conflictError('The series changed, try again');
    }
  }

  private async requireExpense(id: string) {
    const expense = await this.expenseRepository.getExpenseState(id);
    if (!expense) {
      throw new Error('Expense id not found');
    }
    return expense;
  }
}
