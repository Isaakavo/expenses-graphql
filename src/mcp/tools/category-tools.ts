import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { sequelizeClient } from '../../database/client.js';
import { CategoryService } from '../../service/category-service.js';
import { textResponse, errorResponse } from '../utils.js';

export function registerCategoryTools(server: McpServer, userId: string) {
  server.registerTool(
    'list-categories',
    { description: 'List all expense categories and subcategories' },
    async () => {
      try {
        const service = new CategoryService(userId, sequelizeClient);
        const categories = await service.getCategoryList();
        return textResponse(categories);
      } catch (error) {
        return errorResponse(error.message);
      }
    }
  );
}
