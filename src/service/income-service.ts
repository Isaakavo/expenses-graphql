import { Income } from '../models/income.js';
import { CreateIncomeInput } from '../generated/graphql.js';
import { Date as CustomDate } from '../scalars/date.js';
import { Context } from '../index.js';

export class IncomeService {
  async createIncome(input: CreateIncomeInput, context: Context) {
    const { total, paymentDate, comment } = input;
    const {
      user: { userId },
    } = context;
    const parsedPaymentDay = CustomDate.parseValue(paymentDate);
    const parsedCreatedAt = CustomDate.parseValue(new Date().toISOString());

    return await Income.create({
      userId,
      total,
      comment: comment?.trim() ?? '',
      paymentDate: parsedPaymentDay,
      createdAt: parsedCreatedAt,
    });
  }
}
