import { Goal } from '../generated/graphql.js';
import { GoalDTO } from '../dto/goal-dto.js';
import { formatCurrency } from './income-adapter.js';

// Sequelize Goal row -> GoalDTO
export const adaptGoalDTO = (goal): GoalDTO => {
  return {
    id: goal.id,
    userId: goal.userId,
    name: goal.name,
    targetAmount: Number(goal.targetAmount),
    currency: goal.currency,
    startDate: goal.startDate,
    endDate: goal.endDate ?? null,
  };
};

// GoalDTO -> GraphQL Goal. `expenses` is resolved by the Goal.expenses field resolver
export const adaptGoal = (goal: GoalDTO): Goal => {
  return {
    id: goal.id,
    name: goal.name,
    targetAmount: formatCurrency(goal.targetAmount),
    currency: goal.currency,
    startDate: goal.startDate,
    endDate: goal.endDate,
    expenses: [],
  };
};

export const adaptGoals = (goals: GoalDTO[]): Goal[] => goals.map(adaptGoal);
