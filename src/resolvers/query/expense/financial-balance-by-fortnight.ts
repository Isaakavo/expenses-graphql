import { QueryResolvers } from '../../../generated/graphql.js';

export const financialBalanceByFortnight: QueryResolvers['financialBalanceByFortnight'] =
  async () => {
    return {
      debts: 0.0,
      remaining: 0.0,
    };
  };
