import { Date } from '../scalars/date.js';
import { QueryResolvers } from '../generated/graphql';

const queries: QueryResolvers = {
  expenses: async (_, __) => {
    return [
      {
        concept: 'hola mundo',
        dateAdded: Date.parseValue("2023-09-22")
      },
    ];
  },
};

export default queries;
