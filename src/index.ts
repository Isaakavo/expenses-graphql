import { ApolloServer } from '@apollo/server';
import { startStandaloneServer } from '@apollo/server/standalone';
import { AxiosInstance } from 'axios';
import { readFileSync } from 'fs';
import { Sequelize } from 'sequelize';
import { instance } from './auth/axios-instance.js';
import { resolverUser } from './auth/resolve-user.js';
import { sequelizeClient } from './database/client.js';
import { syncTables } from './database/sync-database.js';
import resolvers from './resolvers/index.js';
import { logger } from './logger.js';
import { GraphQLError } from 'graphql';

export interface User {
  userId?: string;
  exp?: number;
  tokenUse?: string;
  authTime?: string;
  expiredAt?: string;
}

export interface Context {
  sequelizeClient: Sequelize;
  axiosClient: AxiosInstance;
  user?: User;
}

const startServer = async () => {
  await syncTables(sequelizeClient);

  const typeDefs = readFileSync('./schema.graphql', { encoding: 'utf-8' });

  const server = new ApolloServer<Context>({
    typeDefs,
    resolvers,
  });

  return await startStandaloneServer(server, {
    listen: { port: process.env.NODE_ENV === 'production' ? 3000 : 4000 },
    context: async ({ req }) => {
      try {
        return {
          sequelizeClient: sequelizeClient,
          axiosClient: instance,
          user: await resolverUser(req),
        };
      } catch (error) {
        if (error instanceof GraphQLError) {
          logger.error(`Graphql Error: ${error.message} %j`, error.extensions);
          throw error;
        }

        logger.error(error);
        throw error;
      }
    },
  });
};

startServer().then(({ url }) => {
  logger.info(`Server ready at: ${url}`);
});
