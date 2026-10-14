import { CurrencyCode } from '../generated/graphql.js';

export type CardDTO = {
  id: string;
  bank: string;
  userId: string;
  alias: string;
  isDebit: boolean;
  isDigital: boolean;
  currency: CurrencyCode | null;
}
