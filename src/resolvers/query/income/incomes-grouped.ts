import {IncomeService} from '../../../service/income-service.js';

export const incomesGroupedBy = async (_, __, context) => {
  const {
    user: { userId },
    sequelizeClient,
  } = context;

  const incomeService = new IncomeService(userId, sequelizeClient);

  return incomeService.getIncomeBy();
};
