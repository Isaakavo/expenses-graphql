import { QueryResolvers } from 'generated/graphql';

export const categoryAllocation: QueryResolvers['categoryAllocation'] = async (
  _,
  __,
  { user: { userId }, sequilizeClient }
) => {
  
  return [
    {
      sum: '',
      category: {},
      period: [],
      income: {},
      expenses: []
    }
  ]
};
