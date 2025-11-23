

export type InvestmentDto = {
  id: string;
  userId: string;
  amount: number;
  udiAmount: number;
  udiValue: number;
  purchasedOn: Date;
  createdAt?: Date;
  updatedAt?: Date;
}
