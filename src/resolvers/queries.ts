import { Date } from '../scalars/date.js';
import { QueryResolvers } from '../generated/graphql';

const queries: QueryResolvers = {
  expenses: async (_, __, context) => {
    const { user } = context;
    const  {username}  = await user();
    console.log({username});
    
    return [
      {
        concept: 'hola mundo',
        total: 500,
        dateAdded: Date.parseValue("2023-09-01")
      },
    ];
  },
};

export default queries;
