import { MutationResolvers } from '../../../generated/graphql.js';
import { logger } from '../../../logger.js';
import { Income } from '../../../models/income.js';
import { Date as CustomDate } from '../../../scalars/date.js';
import { calculateFortnight } from '../../../utils/date-utils.js';

//TODO implement logic to handle the create of incomes for 1 year
// add a new flag to indicate if the mutation should create 12 new incomes with the provided inputs
export const createIncome: MutationResolvers['createIncome'] = async (
  _,
  { input },
  context
) => {
  const { total, paymentDate, comment } = input;
  const {
    user: { userId },
  } = context;

  const parsedPaymentDay = CustomDate.parseValue(paymentDate);
  const parsedCreatedAt = CustomDate.parseValue(new Date().toISOString());

  const newIncome = await Income.create({
    userId,
    total,
    comment: comment?.trim() ?? '',
    paymentDate: parsedPaymentDay,
    createdAt: parsedCreatedAt,
  });

  logger.info(`Income added with id ${newIncome.id}`);
  return {
    id: newIncome.id.toString(),
    userId: newIncome.userId,
    total: newIncome.total,
    paymentDate: {
      date: newIncome.paymentDate,
      fortnight: calculateFortnight(parsedPaymentDay),
    },
    createdAt: newIncome.createdAt,
  };
};
