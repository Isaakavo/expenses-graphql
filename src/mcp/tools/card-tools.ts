import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { adaptCard } from '../../adapters/income-adapter.js';
import { Card } from '../../models/index.js';
import { textResponse, errorResponse } from '../utils.js';

export function registerCardTools(server: McpServer, userId: string) {
  server.registerTool(
    'list-cards',
    { description: 'List all payment cards' },
    async () => {
      try {
        const cards = await Card.findAll({ where: { userId } });
        return textResponse(cards.map((card) => adaptCard(card)));
      } catch (error) {
        return errorResponse(error.message);
      }
    }
  );
}
