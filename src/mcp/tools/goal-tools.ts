import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { sequelizeClient } from '../../database/client.js';
import { GoalService } from '../../service/goal-service.js';
import {
  adaptGoal,
  adaptGoalReimbursement,
} from '../../adapters/goal-adapter.js';
import { textResponse, errorResponse } from '../utils.js';

export function registerGoalTools(server: McpServer, userId: string) {
  server.registerTool(
    'list-goals',
    {
      description:
        'List savings goals and reimbursable goals (events fronted from savings) with their reimbursements',
    },
    async () => {
      try {
        const service = new GoalService(userId, sequelizeClient);
        const goals = await service.getGoals();
        const reimbursements = await service.getReimbursementsGroupedByGoalIds(
          goals.map((goal) => goal.id)
        );
        return textResponse(
          goals.map((goal, index) => ({
            ...adaptGoal(goal),
            reimbursements: reimbursements[index].map(adaptGoalReimbursement),
          }))
        );
      } catch (error) {
        return errorResponse(error.message);
      }
    }
  );

  server.registerTool(
    'add-goal-reimbursement',
    {
      description: 'Record money paid back for a reimbursable goal',
      inputSchema: {
        goalId: z.string().describe('ID of a REIMBURSABLE goal'),
        amount: z.number().positive().describe('Amount received, in the goal currency'),
        receivedOn: z.string().describe('Date received (yyyy-MM-dd)'),
        comment: z.string().optional().describe('Optional comment'),
      },
    },
    async (input) => {
      try {
        const service = new GoalService(userId, sequelizeClient);
        return textResponse(
          adaptGoalReimbursement(await service.addReimbursement(input))
        );
      } catch (error) {
        return errorResponse(error.message);
      }
    }
  );
}
