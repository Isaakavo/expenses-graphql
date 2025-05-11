import { adaptSingleIncome } from '../../../adapters/income-adapter.js';
import { MutationResolvers } from '../../../generated/graphql.js';
import { Income } from '../../../models/income.js';
import { Date as CustomDate } from '../../../scalars/date.js';
import { updateElement } from '../../../utils/sequilize-utils.js';

export const updateIncome: MutationResolvers['updateIncome'] = async (
  _,
  { input },
  context
) => {
  const {
    user: { userId },
  } = context;
  const { incomeId, total, paymentDate, comment } = input;

  const updateParams = {
    total,
    comment: comment?.trim() ?? '',
    paymentDate: CustomDate.parseValue(paymentDate),
    updatedAt: CustomDate.parseValue(new Date().toISOString()),
  };

  const updatedIncome = await updateElement(
    Income,
    userId,
    incomeId,
    updateParams
  );

  return adaptSingleIncome(updatedIncome[0] as Income);
};
