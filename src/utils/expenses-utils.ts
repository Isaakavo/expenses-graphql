import { Op, WhereOptions } from 'sequelize';
import { Income } from '../models/income.js';
import { GoalRole } from '../generated/graphql.js';

// NULL-safe: a plain `<> 'SPENDING'` drops unlinked rows
export const excludeGoalSpending: WhereOptions = {
  goalRole: { [Op.or]: { [Op.is]: null, [Op.ne]: GoalRole.SPENDING } },
};

export const findIncomeByIdWithExpenses = async (
  incomeExpenses: WhereOptions = {}
) => {
  return await Income.findAll({
    where: incomeExpenses,
  });
};
