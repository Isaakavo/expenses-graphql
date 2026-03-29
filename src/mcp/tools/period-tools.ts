import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { sequelizeClient } from '../../database/client.js';
import { PeriodService } from '../../service/period-service.js';
import { adaptPeriod } from '../../adapters/period-adapter.js';
import { textResponse, errorResponse } from '../utils.js';

export function registerPeriodTools(server: McpServer, userId: string) {
  server.registerTool(
    'list-periods',
    { description: 'List all periods (fortnights)' },
    async () => {
      try {
        const service = new PeriodService(userId, sequelizeClient);
        const periods = await service.getAllPeriods();
        return textResponse(periods.map((p) => adaptPeriod(p)));
      } catch (error) {
        return errorResponse(error.message);
      }
    }
  );
}
