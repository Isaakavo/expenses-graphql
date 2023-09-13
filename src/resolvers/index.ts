import { Resolvers } from 'generated/graphql';
import Query from './queries.js';
import Mutation from './mutation.js'

const resolvers: Resolvers = { Query, Mutation };

export default resolvers;
