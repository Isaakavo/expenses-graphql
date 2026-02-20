import { Period } from '../../../models/periods.js';
import { adaptSingleIncome } from '../../../adapters/index.js';
import { QueryResolvers } from '../../../generated/graphql.js';
import { Income } from '../../../models/index.js';
import { Op } from 'sequelize';
import { adaptIncomeDTO } from '../../../adapters/income-adapter.js';

export const incomeById: QueryResolvers['incomeById'] = async (
  _,
  { incomeId },
  context
) => {
  const {
    user: { userId },
  } = context;

  // Income Id can be either the income's ID or the period's ID
  const income = await Income.findOne({
    where: {
      userId,
      [Op.or]: [{ id: incomeId }, { periodId: incomeId }],
    },
    include: [
      {
        model: Period,
        as: 'period',
        where: {
          userId,
        },
      },
    ],
  });

  return adaptSingleIncome(adaptIncomeDTO(income));
};
