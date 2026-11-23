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
import { splitSeriesTemplate } from '../utils/split-installments.js';
import { AMOUNT_SCALE, formatDecimal, parseDecimal } from '../utils/decimal.js';
import { formatCurrency } from '../adapters/income-adapter.js';
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

const centsOf = (value: string | number) => parseDecimal(value, AMOUNT_SCALE);

const toNumber = (cents: bigint) => Number(formatDecimal(cents, AMOUNT_SCALE));

const seriesAmountOf = (expense: Expense) =>
  centsOf(expense.originalCurrency ? expense.originalTotal : expense.total);

const withAmount = (template: SeriesTemplate, last: Expense, cents: bigint): SeriesTemplate => {
  const foreign = template.foreignAmount;
  if (!foreign) {
    return { ...template, total: toNumber(cents) };
  }
  const original = centsOf(last.originalTotal);
  const total = foreign.fixedRate
    ? toNumber((2n * cents * centsOf(last.total) + original) / (2n * original))
    : template.total;
  return { ...template, total, foreignAmount: { ...foreign, amount: toNumber(cents) } };
};

const enteredAmount = (expense: Expense, input: ExpenseUpdate) => {
  if (input.foreignAmount) return input.foreignAmount.amount;
  if (input.foreignAmount === null || !expense.originalCurrency) return input.total;
  return undefined;
};

const changesSeriesAmount = (expense: Expense, input: ExpenseUpdate) => {
  const switchesCurrency =
    input.foreignAmount !== undefined && Boolean(input.foreignAmount) !== Boolean(expense.originalCurrency);
  const amount = enteredAmount(expense, input);
  return switchesCurrency || (amount != null && centsOf(amount) !== seriesAmountOf(expense));
};

const templateAmount = (template: SeriesTemplate) =>
  centsOf(template.foreignAmount?.amount ?? template.total);

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
        ? {
          id: row.recurrenceId,
          frequency: row.frequency,
          position: row.position,
          count: row.count,
          plannedTotal: row.plannedTotal == null ? null : formatCurrency(Number(row.plannedTotal)),
        }
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
    const amountChanged = changesSeriesAmount(selected, input);

    return this.sequelize.transaction(async (transaction) => {
      await this.lockUnchanged({ recurrence, series }, transaction);
      if (amountChanged && recurrence.plannedTotal != null) {
        await this.recurrenceRepository.clearPlannedTotal(recurrence.id, { transaction });
      }
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
    const { templates: futureTemplates, resplit } = this.futureTemplates(
      recurrence,
      count != null,
      past,
      last,
      targetCount - past.length
    );
    const moves = await this.planMoves(keptUpcoming, redated, resplit ? futureTemplates : null);
    const planned = await this.expensesService.planSeries(
      futureTemplates.slice(keptUpcoming.length),
      seriesDates(lastDate, nextFrequency, targetCount - kept.length, 1)
    );

    await this.sequelize.transaction(async (transaction) => {
      await this.lockUnchanged({ recurrence, series }, transaction);
      if (frequencyChanged) {
        await this.recurrenceRepository.updateFrequency(id, nextFrequency, { transaction });
      }
      await sequential(moves, (plan) => this.expensesService.applyUpdate(plan, transaction));
      if (removed.length > 0) {
        await this.expenseRepository.deleteExpenses(
          removed.map((expense) => expense.id),
          { transaction }
        );
      }
      if (planned.length > 0) {
        await this.expensesService.createSeriesExpenses(
          planned,
          { recurrenceId: id, firstIndex: last.recurrenceIndex + 1 },
          transaction
        );
      }
    });

    return this.getSeries(id);
  }

  private futureTemplates(
    recurrence: ExpenseRecurrence,
    countChanged: boolean,
    past: Expense[],
    last: Expense,
    futureCount: number
  ): { templates: SeriesTemplate[]; resplit: boolean } {
    const template = templateOf(last);
    if (recurrence.plannedTotal == null || !countChanged) {
      return { templates: Array.from({ length: futureCount }, () => template), resplit: false };
    }
    const paid = past.reduce((acc, expense) => acc + seriesAmountOf(expense), 0n);
    const remaining = centsOf(recurrence.plannedTotal) - paid;
    if (remaining < BigInt(futureCount)) {
      throw validationError('count leaves less than one cent per remaining occurrence', 'count');
    }
    return {
      templates: splitSeriesTemplate(withAmount(template, last, remaining), futureCount),
      resplit: true,
    };
  }

  private async planMoves(
    expenses: Expense[],
    dates: Date[],
    amounts: SeriesTemplate[] | null
  ): Promise<UpdatePlan[]> {
    const moves = expenses
      .map((expense, i) => {
        const template = amounts?.[i];
        const repriced = template != null && templateAmount(template) !== seriesAmountOf(expense);
        return { expense, payBefore: dates[i], template: repriced ? template : null };
      })
      .filter(({ expense, payBefore, template }) =>
        template != null || isoDay(expense.payBefore) !== isoDay(payBefore));
    return sequential(moves, ({ expense, payBefore, template }) =>
      this.expensesService.planUpdate(expense.id, {
        payBefore,
        ...(template && { total: template.total, foreignAmount: template.foreignAmount }),
      })
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
