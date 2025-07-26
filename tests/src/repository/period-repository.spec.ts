import { Expense, Income, Period } from '../../../src/models';
import { testSequelize } from '../database/test-client';

beforeAll(async () => {
  await testSequelize.sync({ force: true });
});

afterAll(async () => {
  await testSequelize.close();
});

test('asigna periodId a expenses según income', async () => {
  // const income = await Income.create({
  //   id: 'income1',
  //   total: 1000,
  //   paymentDate: new Date('2025-07-15'),
  //   userId: 'user1',
  // });

  // const expense = await Expense.create({
  //   id: 'expense1',
  //   amount: 200,
  //   userId: 'user1',
  //   date: new Date('2025-07-16'),
  // });

  //await backfillPeriods(); // tu función que rellena los periods

  const updatedExpense = await Expense.findByPk('expense1');
  expect(updatedExpense?.periodId).not.toBeNull();

  const relatedPeriod = await Period.findByPk(updatedExpense?.periodId);
  expect(relatedPeriod?.startDate <= expense.date).toBe(true);
  expect(relatedPeriod?.endDate >= expense.date).toBe(true);
});
