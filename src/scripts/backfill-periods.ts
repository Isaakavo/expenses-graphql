import { Income } from '../models/income.js';
import { Expense } from '../models/expense.js';
import { Period } from '../models/period.js';

import { Op } from 'sequelize';
import { sequelize } from '../database/client.js';

async function main() {
  const incomes = await Income.findAll();

  for (const income of incomes) {
    const date = income.paymentDate;
    const userId = income.userId;

    const startDate =
      date.getDate() <= 15
        ? new Date(date.getFullYear(), date.getMonth(), 1)
        : new Date(date.getFullYear(), date.getMonth(), 16);

    const endDate =
      date.getDate() <= 15
        ? new Date(date.getFullYear(), date.getMonth(), 15)
        : new Date(date.getFullYear(), date.getMonth() + 1, 0);

    const [period] = await Period.findOrCreate({
      where: { userId, startDate, endDate },
      defaults: { type: 'fortnightly' },
    });

    await income.update({ periodId: period.id });

    await Expense.update(
      { periodId: period.id },
      {
        where: {
          userId,
          payBefore: {
            [Op.between]: [startDate, endDate],
          },
          periodId: null,
        },
      }
    );
  }

  console.log('✅ Backfill terminado');
  await sequelize.close();
}

main().catch(console.error);
