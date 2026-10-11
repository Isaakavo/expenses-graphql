export type GoalDTO = {
  id: string;
  userId: string;
  name: string;
  targetAmount: number;
  // ISO date yyyy-MM-dd
  startDate: string;
  endDate: string | null;
};
