import { ApolloServer } from '@apollo/server';
import { startStandaloneServer } from '@apollo/server/standalone';
import { AxiosInstance } from 'axios';
import { readFileSync } from 'fs';
import { GraphQLError } from 'graphql';
import { Sequelize } from 'sequelize';
import { instance } from './auth/axios-instance.js';
import { verifyJwt } from './auth/verify-jwt.js';
import { connectDatabase, sequilize } from './database/client.js';
import { syncTables } from './database/sync-database.js';
import resolvers from './resolvers/index.js';

export interface User {
  userId?: string;
  exp?: number;
  tokenUse?: string;
  authTime?: string;
  expiredAt?: string;
}

export interface Context {
  sequilizeClient: Sequelize;
  axiosClient: AxiosInstance;
  user: () => Promise<User>;
}

await connectDatabase();
await syncTables();

const typeDefs = readFileSync('./schema.graphql', { encoding: 'utf-8' });

const server = new ApolloServer<Context>({
  typeDefs,
  resolvers,
});

const { url } = await startStandaloneServer(server, {
  listen: { port: 4000 },
  context: async ({ req, res }) => ({
    sequilizeClient: sequilize,
    axiosClient: instance,
    user: async () => {
      const token = req.headers['x-session-key'] || '';
      try {
        const decodedUser = await verifyJwt(token as string);
        return decodedUser;
      } catch (error) {
        if (error instanceof GraphQLError) {
          console.log('Invalid token');
          
          throw error;
        }
        console.error(error);
      }
    },
  }),
});

console.log(`🚀  Server ready at: ${url}`);
