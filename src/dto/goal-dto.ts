import { CurrencyCode, GoalKind } from '../generated/graphql.js';
import { CardDTO } from './card-dto.js';

export type SavingsFundDTO = {
  id: string;
  name: string;
  currency: CurrencyCode;
};

export type GoalDTO = {
  id: string;
  userId: string;
  name: string;
  kind: GoalKind;
  targetAmount: number | null;
  currency: CurrencyCode;
  // ISO date yyyy-MM-dd
  startDate: string;
  endDate: string | null;
  fund: SavingsFundDTO | null;
  defaultCard: CardDTO | null;
};

export type GoalReimbursementDTO = {
  id: string;
  goalId: string;
  amount: number;
  receivedOn: string;
  comment: string | null;
};
