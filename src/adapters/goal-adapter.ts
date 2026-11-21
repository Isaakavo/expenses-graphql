import { Goal, GoalReimbursement, SavingsFund } from '../generated/graphql.js';
import {
  GoalDTO,
  GoalReimbursementDTO,
  SavingsFundDTO,
} from '../dto/goal-dto.js';
import { formatCurrency } from './income-adapter.js';
import { adaptCardDTO } from './card-adapter.js';

export const adaptSavingsFundDTO = (fund): SavingsFundDTO => ({
  id: fund.id,
  name: fund.name,
  currency: fund.currency,
});

// Sequelize Goal row -> GoalDTO
export const adaptGoalDTO = (goal): GoalDTO => {
  return {
    id: goal.id,
    userId: goal.userId,
    name: goal.name,
    kind: goal.kind,
    targetAmount: goal.targetAmount == null ? null : Number(goal.targetAmount),
    currency: goal.currency,
    startDate: goal.startDate,
    endDate: goal.endDate ?? null,
    fund: goal.fund ? adaptSavingsFundDTO(goal.fund) : null,
    defaultCard: goal.defaultCard ? adaptCardDTO(goal.defaultCard) : null,
  };
};

export const adaptGoalReimbursementDTO = (
  reimbursement
): GoalReimbursementDTO => ({
  id: reimbursement.id,
  goalId: reimbursement.goalId,
  amount: Number(reimbursement.amount),
  receivedOn: reimbursement.receivedOn,
  comment: reimbursement.comment ?? null,
});

export const adaptSavingsFund = (fund: SavingsFundDTO): SavingsFund => ({
  ...fund,
});

export const adaptGoalReimbursement = (
  reimbursement: GoalReimbursementDTO
): GoalReimbursement => ({
  ...reimbursement,
  amount: formatCurrency(reimbursement.amount),
});

// GoalDTO -> GraphQL Goal. `expenses` and `reimbursements` are resolved by Goal field resolvers
export const adaptGoal = (goal: GoalDTO): Goal => {
  return {
    id: goal.id,
    name: goal.name,
    kind: goal.kind,
    targetAmount:
      goal.targetAmount == null ? null : formatCurrency(goal.targetAmount),
    currency: goal.currency,
    startDate: goal.startDate,
    endDate: goal.endDate,
    fund: goal.fund ? adaptSavingsFund(goal.fund) : null,
    defaultCard: goal.defaultCard,
    expenses: [],
    reimbursements: [],
  };
};

export const adaptGoals = (goals: GoalDTO[]): Goal[] => goals.map(adaptGoal);
