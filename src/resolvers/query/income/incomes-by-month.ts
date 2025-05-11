import { Income } from '../../../models/index.js';
import { calculateFortnight } from '../../../utils/date-utils.js';
import { whereByMonth } from '../../../utils/where-fortnight.js';

export const incomesByMonth = async (_, input, context) => {
  const { date } = input;
  const {
    user: { userId },
  } = context;

  const where = whereByMonth(userId, date, 'paymentDate');

  const allIncomes = await Income.findAll({ where });

  return allIncomes.map((x) => ({
    id: x.id.toString(),
    userId: x.userId,
    total: x.total,
    paymentDate: {
      date: x.paymentDate,
      fortnight: calculateFortnight(x.paymentDate),
    },
    createdAt: x.createdAt,
  }));
};
