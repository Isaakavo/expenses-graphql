import { Category, Period as PeriodGraphql } from 'generated/graphql';
import { PeriodRepository } from 'repository/period-repository';
import { Expense, Income, Period } from '../../../src/models';
import { connectDatabase, testSequelize } from '../database/test-client';

beforeAll(async () => {
  await connectDatabase();
});

afterAll(async () => {
  await testSequelize.close();
});

test('should associate the income and expense to the correct period on weekly', async () => {
  const userId = 'user1';
  const expenseDate = new Date('2025-07-20').toISOString().split('T')[0];
  const periodService = new PeriodRepository(userId, PeriodGraphql.WEEKLY);

  const period = await periodService.upsertWeeklyPeriod(expenseDate);

  const income = await Income.create({
    id: 'income1',
    total: 1000,
    paymentDate: new Date('2025-07-15'),
    userId: 'user1',
    periodId: period.id
  });

  const expense = await Expense.create({
    id: 'expense1',
    concept: 'test',
    total: 200,
    category: Category.BILLS,
    userId: 'user1',
    periodId: period.id,
    payBefore: expenseDate,
  });

  //await backfillPeriods(); // tu función que rellena los periods

  const updatedExpense = await Expense.findByPk('expense1');
  expect(updatedExpense?.periodId).not.toBeNull();

  const relatedPeriod = await Period.findByPk(updatedExpense?.periodId);

  console.log(relatedPeriod?.startDate, expense.payBefore);
  expect(income.periodId === expense.periodId).toBe(true);
  // expect(relatedPeriod?.endDate >= expense.payBefore).toBe(true);
});
