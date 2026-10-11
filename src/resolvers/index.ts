import { Resolvers } from 'generated/graphql';
import Query from './queries.js';
import Mutation from './mutation.js'
import { Categories, SubCategory } from './types/category-types.js';

const resolvers: Resolvers = { Query, Mutation, SubCategory, Categories };

export default resolvers;
