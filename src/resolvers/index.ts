import { Resolvers } from 'generated/graphql';
import Query from './queries.js';
import Mutation from './mutation.js'
import { Goal } from './types/goal-types.js';
import { Expense } from './types/expense-types.js';

const resolvers: Resolvers = { Query, Mutation, Goal, Expense };

export default resolvers;
