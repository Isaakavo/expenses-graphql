import { ApolloServer } from '@apollo/server';
import { startStandaloneServer } from '@apollo/server/standalone';
import { readFileSync } from 'fs';
import resolvers from './resolvers/index.js';
import { Sequelize } from 'sequelize';
import { connectDatabase, sequilize } from './database/client.js';
import { syncTables } from './database/sync-database.js';
import { verifyJwt } from './auth/verify-jwt.js';
import { GraphQLError } from 'graphql';

export interface User {
  userId: string;
  exp: number;
  tokenUse: string;
  authTime: string;
}

export interface Context {
  sequilizeClient: Sequelize;
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
    user: async () => {
      const token = req.headers['x-session-key'] || '';
      try {
        const decodedUser = await verifyJwt(token as string);
        return decodedUser;
      } catch (error) {
        throw new GraphQLError(error, {
          extensions: {
            code: 'UNAUTHENTICATED',
            http: { status: 401 },
          },
        });
      }
    },
  }),
});

console.log(`🚀  Server ready at: ${url}`);
