import { IncomeService } from '../../../service/income-service.js';

export const incomesGroupedBy = async (_, __, context) => {
  const {
    user: { userId },
    sequilizeClient,
  } = context;

  const incomeService = new IncomeService(userId, sequilizeClient);

  const groupedIncomes = incomeService.getIncomeBy();

  return groupedIncomes;
};
