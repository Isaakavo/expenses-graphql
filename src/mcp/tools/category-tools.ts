import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { sequelizeClient } from '../../database/client.js';
import { adaptCategoryToGraphql } from '../../adapters/category-adapter.js';
import { CategoryStatus } from '../../generated/graphql.js';
import { CategoryService } from '../../service/category-service.js';
import { textResponse, errorResponse } from '../utils.js';

export function registerCategoryTools(server: McpServer, userId: string) {
  server.registerTool(
    'list-categories',
    {
      description:
        'List expense categories and subcategories with their status (ACTIVE/ARCHIVED) and origin (DEFAULT/CUSTOM). ' +
        'The statuses filter applies independently to categories and subcategories; defaults to ACTIVE only.',
      inputSchema: {
        statuses: z
          .array(z.nativeEnum(CategoryStatus))
          .min(1)
          .optional()
          .describe('Statuses to include (default ["ACTIVE"])'),
      },
    },
    async ({ statuses }) => {
      try {
        const service = new CategoryService(userId, sequelizeClient);
        const categories = await service.getCategoryList(statuses ?? [CategoryStatus.ACTIVE]);
        return textResponse(categories.map(adaptCategoryToGraphql));
      } catch (error) {
        return errorResponse(error.message);
      }
    }
  );
}
