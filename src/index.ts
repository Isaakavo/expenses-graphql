import { ApolloServer } from '@apollo/server';
import { startStandaloneServer } from '@apollo/server/standalone';
import { AxiosInstance } from 'axios';
import { readFileSync } from 'fs';
import { Sequelize } from 'sequelize';
import { instance } from './auth/axios-instance.js';
import { resolverUser } from './auth/resolve-user.js';
import { connectDatabase, sequelize } from './database/client.js';
import { syncTables } from './database/sync-database.js';
import resolvers from './resolvers/index.js';
import { logger } from './logger.js';

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
  user: User;
}

const startServer = async () => {
  await connectDatabase();
  await syncTables();

  const typeDefs = readFileSync('./schema.graphql', { encoding: 'utf-8' });

  const server = new ApolloServer<Context>({
    typeDefs,
    resolvers,
  });

  return await startStandaloneServer(server, {
    listen: { port: 4000 },
    context: async ({ req }) => ({
      sequilizeClient: sequelize,
      axiosClient: instance,
      user: await resolverUser(req),
    }),
  });
};

startServer().then(({ url }) => {
  logger.info(`🚀 Server ready at: ${url}`);
});
