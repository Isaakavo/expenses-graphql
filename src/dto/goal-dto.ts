import { CurrencyCode } from '../generated/graphql.js';

export type GoalDTO = {
  id: string;
  userId: string;
  name: string;
  targetAmount: number;
  currency: CurrencyCode;
  // ISO date yyyy-MM-dd
  startDate: string;
  endDate: string | null;
};
