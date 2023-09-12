import { QueryResolvers } from '../generated/graphql';

const queries: QueryResolvers = {
  expenses: async (_, __) => {
    return [
      {
        concept: 'hola mundo',
      },
    ];
  },
};

export default queries;
