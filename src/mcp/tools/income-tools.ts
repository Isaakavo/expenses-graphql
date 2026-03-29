import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { sequelizeClient } from '../../database/client.js';
import { IncomeService } from '../../service/income-service.js';
import { ExpensesService } from '../../service/expenses-service.js';
import { adaptSingleIncome, formatCurrency } from '../../adapters/income-adapter.js';
import { adaptGroupedExpenses } from '../../adapters/expense-adapter.js';
import { textResponse, errorResponse } from '../utils.js';

export function registerIncomeTools(server: McpServer, userId: string) {
  server.registerTool(
    'list-incomes',
    { description: 'List all incomes with totals' },
    async () => {
      try {
        const service = new IncomeService(userId, sequelizeClient);
        const allIncomes = await service.getAllIncomes();
        const total = allIncomes.reduce((acc, income) => acc + income.total, 0);
        return textResponse({
          incomes: allIncomes.map((income) => adaptSingleIncome(income)),
          total: formatCurrency(total),
          count: allIncomes.length,
        });
      } catch (error) {
        return errorResponse(error.message);
      }
    }
  );

  server.registerTool(
    'incomes-with-expenses',
    {
      description: 'Get incomes and associated expenses for a period, with totals and remaining balance',
      inputSchema: {
        periodId: z.string().optional().describe('Period ID to filter by'),
        startDate: z.string().optional().describe('Start date (ISO format)'),
        endDate: z.string().optional().describe('End date (ISO format)'),
      },
    },
    async ({ periodId, startDate, endDate }) => {
      try {
        const incomeService = new IncomeService(userId, sequelizeClient);
        const expenseService = new ExpensesService(userId, sequelizeClient);

        const parsedStart = startDate ? new Date(startDate) as unknown as Date : undefined;
        const parsedEnd = endDate ? new Date(endDate) as unknown as Date : undefined;

        const { incomes, incomesTotal } = await incomeService.getIncomeByPeriod(
          periodId, parsedStart, parsedEnd
        );
        const { expenses, expensesTotal } =
          await expenseService.getExpensesGroupedExpenses(periodId, parsedStart, parsedEnd);

        return textResponse({
          incomes,
          groupedExpenses: adaptGroupedExpenses(expenses),
          incomesTotal: formatCurrency(incomesTotal),
          expensesTotal: formatCurrency(expensesTotal),
          remaining: formatCurrency(incomesTotal - expensesTotal),
        });
      } catch (error) {
        return errorResponse(error.message);
      }
    }
  );

  server.registerTool(
    'create-income',
    {
      description: 'Create a new income entry',
      inputSchema: {
        total: z.number().positive().describe('Income amount'),
        paymentDate: z.string().describe('Payment date (ISO format)'),
        comment: z.string().optional().describe('Optional comment'),
      },
    },
    async (input) => {
      try {
        const service = new IncomeService(userId, sequelizeClient);
        const income = await service.createIncome({
          total: input.total,
          paymentDate: input.paymentDate as unknown as Date,
          comment: input.comment,
        });
        return textResponse(adaptSingleIncome(income));
      } catch (error) {
        return errorResponse(error.message);
      }
    }
  );

  server.registerTool(
    'delete-income',
    {
      description: 'Delete an income by ID',
      inputSchema: { id: z.string().describe('Income ID to delete') },
    },
    async ({ id }) => {
      try {
        const service = new IncomeService(userId, sequelizeClient);
        const result = await service.deleteIncome({ id });
        return textResponse({ deleted: result, id });
      } catch (error) {
        return errorResponse(error.message);
      }
    }
  );
}
