import { MutationResolvers } from 'generated/graphql';
import { Date } from '../scalars/date.js';

const mutations: MutationResolvers = {
  createIncome: async (_, input) => {
    const { total, dateAdded, paymentDate } = input;

    return {
      total: total,
      dateAdded: Date.parseValue(dateAdded),
      paymentDate: Date.parseValue(paymentDate),
    };
  },
};

export default mutations;
