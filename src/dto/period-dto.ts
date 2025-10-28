
export enum PeriodType {
  WEEKLY = 'WEEKLY',
  MONTHLY = 'MONTHLY',
  FORTNIGHTLY = 'FORTNIGHTLY',
}

export type PeriodDTO = {
  id: string;
  userId: string;
  type?: PeriodType | null;
  startDate: string;
  endDate: string;
  createdAt?: string;
  updatedAt?: string;
}
