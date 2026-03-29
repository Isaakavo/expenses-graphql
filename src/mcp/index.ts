import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { sequelizeClient } from '../database/client.js';
import { syncTables } from '../database/sync-database.js';
import { logger } from '../logger.js';
import { createMcpServer } from './server.js';

const USER_ID = process.env.MCP_USER_ID;

if (!USER_ID) {
  logger.error('MCP_USER_ID environment variable is required');
  process.exit(1);
}

const start = async () => {
  await syncTables(sequelizeClient);

  const server = createMcpServer(USER_ID);
  const transport = new StdioServerTransport();
  await server.connect(transport);

  logger.info('MCP server started');
};

start().catch((error) => {
  logger.error('Failed to start MCP server: ' + error.message);
  process.exit(1);
});
