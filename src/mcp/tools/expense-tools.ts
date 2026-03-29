import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { sequelizeClient } from '../../database/client.js';
import { ExpensesService } from '../../service/expenses-service.js';
import { adaptExpensesDTOInput } from '../../adapters/income-adapter.js';
import { adaptExpensesByCategoryDTO } from '../../adapters/expense-adapter.js';
import { textResponse, errorResponse } from '../utils.js';

export function registerExpenseTools(server: McpServer, userId: string) {
  server.registerTool(
    'list-expenses',
    { description: 'List all expenses for the user' },
    async () => {
      try {
        const service = new ExpensesService(userId);
        const expenses = await service.getAllExpenses();
        return textResponse(expenses.map((e) => adaptExpensesDTOInput(e)));
      } catch (error) {
        return errorResponse(error.message);
      }
    }
  );

  server.registerTool(
    'get-expense',
    {
      description: 'Get a single expense by ID',
      inputSchema: { expenseId: z.string().describe('The expense ID') },
    },
    async ({ expenseId }) => {
      try {
        const service = new ExpensesService(userId);
        const expense = await service.getExpenseById(expenseId);
        if (!expense) return errorResponse('Expense not found');
        return textResponse(adaptExpensesDTOInput(expense));
      } catch (error) {
        return errorResponse(error.message);
      }
    }
  );

  server.registerTool(
    'create-expense',
    {
      description: 'Create a new expense',
      inputSchema: {
        concept: z.string().describe('Description of the expense'),
        total: z.number().positive().describe('Amount of the expense'),
        payBefore: z.string().describe('Due date (ISO format)'),
        periodId: z.string().describe('Period ID this expense belongs to'),
        categoryId: z.string().describe('Category ID'),
        subCategoryId: z.string().describe('Sub-category ID'),
        cardId: z.string().optional().describe('Card ID used for payment'),
        comment: z.string().optional().describe('Optional comment'),
      },
    },
    async (input) => {
      try {
        const service = new ExpensesService(userId);
        const expense = await service.createExpense({
          concept: input.concept,
          total: input.total,
          periodId: input.periodId,
          categoryId: input.categoryId,
          subCategoryId: input.subCategoryId,
          cardId: input.cardId,
          comments: input.comment,
        });
        return textResponse(adaptExpensesDTOInput(expense));
      } catch (error) {
        return errorResponse(error.message);
      }
    }
  );

  server.registerTool(
    'update-expense',
    {
      description: 'Update an existing expense',
      inputSchema: {
        id: z.string().describe('Expense ID to update'),
        concept: z.string().describe('Updated description'),
        total: z.number().positive().describe('Updated amount'),
        payBefore: z.string().describe('Updated due date (ISO format)'),
        subCategoryId: z.string().describe('Updated sub-category ID'),
        cardId: z.string().optional().describe('Updated card ID'),
        comment: z.string().optional().describe('Updated comment'),
      },
    },
    async (input) => {
      try {
        const service = new ExpensesService(userId, sequelizeClient);
        const expense = await service.updateExpense(input.id, {
          concept: input.concept,
          total: input.total,
          payBefore: new Date(input.payBefore),
          subCategoryId: input.subCategoryId,
          cardId: input.cardId,
          comments: input.comment,
        });
        return textResponse(adaptExpensesDTOInput(expense));
      } catch (error) {
        return errorResponse(error.message);
      }
    }
  );

  server.registerTool(
    'expenses-by-category',
    {
      description: 'List expenses grouped by category and subcategory. Supports filtering by period, date range, subcategories, and card.',
      inputSchema: {
        periodId: z.string().optional().describe('Period ID to filter by'),
        startDate: z.string().optional().describe('Start date (ISO format)'),
        endDate: z.string().optional().describe('End date (ISO format)'),
        subCategoryIds: z.array(z.string()).optional().describe('Filter by subcategory IDs'),
        cardId: z.string().optional().describe('Filter by card ID'),
      },
    },
    async (input) => {
      try {
        const service = new ExpensesService(userId, sequelizeClient);
        const expenses = await service.getExpensesByCategory(
          input.periodId,
          input.startDate ? new Date(input.startDate) : undefined,
          input.endDate ? new Date(input.endDate) : undefined,
          input.subCategoryIds,
          input.cardId
        );
        return textResponse(adaptExpensesByCategoryDTO(expenses));
      } catch (error) {
        return errorResponse(error.message);
      }
    }
  );

  server.registerTool(
    'delete-expense',
    {
      description: 'Delete an expense by ID',
      inputSchema: { id: z.string().describe('Expense ID to delete') },
    },
    async ({ id }) => {
      try {
        const service = new ExpensesService(userId, sequelizeClient);
        const result = await service.deleteExpense(id);
        return textResponse({ deleted: result, id });
      } catch (error) {
        return errorResponse(error.message);
      }
    }
  );
}
