

export type InvestmentDto = {
  id: string;
  userId: string;
  amount: number;
  udiAmount: number;
  udiValue: number;
  monthlyBonus?: number;
  udiCommission?: number;
  yearlyBonus?: number;
  conversion?: number;
  feeConversion?: number;
  monthlyTotalBonus?: number;
  purchasedOn: Date;
  createdAt?: Date;
  updatedAt?: Date;
}

export type InvestmentFeeDTO = {
  id: string;
  userId: string;
  monthlyBonus: number;
  udiCommission: number;
  yearlyBonus: number;
  monthlyTotalBonus: number;
  dateAdded: Date;
}
