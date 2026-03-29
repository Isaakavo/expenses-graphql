import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { registerExpenseTools } from './tools/expense-tools.js';
import { registerIncomeTools } from './tools/income-tools.js';
import { registerCategoryTools } from './tools/category-tools.js';
import { registerCardTools } from './tools/card-tools.js';
import { registerPeriodTools } from './tools/period-tools.js';

export function createMcpServer(userId: string): McpServer {
  const server = new McpServer({
    name: 'expenses-api',
    version: '1.0.0',
  });

  registerExpenseTools(server, userId);
  registerIncomeTools(server, userId);
  registerCategoryTools(server, userId);
  registerCardTools(server, userId);
  registerPeriodTools(server, userId);

  return server;
}
