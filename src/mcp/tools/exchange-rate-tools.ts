import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { CurrencyCode } from '../../generated/graphql.js';
import { exchangeRateService } from '../../service/exchange-rate-service.js';
import { textResponse, errorResponse } from '../utils.js';

export function registerExchangeRateTools(server: McpServer) {
  server.registerTool(
    'get-exchange-rate',
    {
      description:
        'Get the official Banxico FIX exchange rate (1 base = rate quote). Weekends and holidays use the latest earlier rate.',
      inputSchema: {
        base: z.enum(CurrencyCode).describe('Currency being converted from'),
        quote: z.enum(CurrencyCode).describe('Currency being converted to'),
        date: z
          .string()
          .regex(/^\d{4}-\d{2}-\d{2}$/)
          .refine((value) => new Date(`${value}T00:00:00Z`).toISOString().startsWith(value), {
            message: 'Not a valid calendar date',
          })
          .optional()
          .describe('Date (YYYY-MM-DD), defaults to today'),
      },
    },
    async (input) => {
      try {
        return textResponse(
          await exchangeRateService.getRate(
            input.base,
            input.quote,
            input.date ?? exchangeRateService.today()
          )
        );
      } catch (error) {
        return errorResponse(error.message);
      }
    }
  );
}
