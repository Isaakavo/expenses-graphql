import { ApolloServer } from '@apollo/server';
import { startStandaloneServer } from '@apollo/server/standalone';
import { readFileSync } from 'fs';
import resolvers from './resolvers/index.js';
import { Sequelize } from 'sequelize';
import { connectDatabase, sequilize } from './database/client.js';
import { syncTables } from './database/sync-database.js';

interface Context {
  sequilizeClient: Sequelize;
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
  }),
});

console.log(`🚀  Server ready at: ${url}`);
