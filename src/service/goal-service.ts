import { Sequelize } from 'sequelize';
import { GraphQLError } from 'graphql';
import { isValid, parseISO } from 'date-fns';
import { GoalInput, GoalRepository } from '../repository/goal-repository.js';
import { GoalDTO } from '../dto/goal-dto.js';
import { ExpenseDTO } from '../dto/expense-dto.js';

const MAX_NAME_LENGTH = 100;
const MAX_TARGET_AMOUNT = 9999999999.99;
const DATE_REGEX = /^\d{4}-\d{2}-\d{2}$/;

export type GoalServiceInput = {
  name: string;
  targetAmount: number;
  startDate: string;
  endDate?: string | null;
};

const validationError = (message: string, argumentName: string) =>
  new GraphQLError(message, {
    extensions: { code: 'VALIDATION_ERROR', argumentName },
  });

const goalNotFound = () =>
  new GraphQLError('Goal not found', {
    extensions: { code: 'GOAL_NOT_FOUND' },
  });

// Dates are plain yyyy-MM-dd strings, no timezone conversion. Rejects 2026-02-30
const isValidIsoDate = (value: unknown): value is string =>
  typeof value === 'string' &&
  DATE_REGEX.test(value) &&
  isValid(parseISO(value)) &&
  new Date(`${value}T00:00:00Z`).toISOString().startsWith(value);

const assertIsoDate = (value: unknown, argumentName: string): string => {
  if (!isValidIsoDate(value)) {
    throw validationError(
      `${argumentName} must be a valid date in yyyy-MM-dd format`,
      argumentName
    );
  }
  return value;
};

export class GoalService {
  goalRepository: GoalRepository;
  userId: string;

  constructor(userId: string, sequelize: Sequelize) {
    this.userId = userId;
    this.goalRepository = new GoalRepository(userId, sequelize);
  }

  private validateEndDate(startDate: string, endDate?: string | null) {
    if (endDate && endDate < startDate) {
      throw validationError(
        'End date must be on or after the start date',
        'endDate'
      );
    }
  }

  private validateAndNormalize(input: GoalServiceInput): GoalInput {
    const name = (input.name ?? '').trim();
    if (name.length < 1 || name.length > MAX_NAME_LENGTH) {
      throw validationError(
        `Name must be between 1 and ${MAX_NAME_LENGTH} characters`,
        'name'
      );
    }

    const { targetAmount } = input;
    if (
      !Number.isFinite(targetAmount) ||
      targetAmount <= 0 ||
      targetAmount > MAX_TARGET_AMOUNT
    ) {
      throw validationError(
        `Target amount must be greater than 0 and at most ${MAX_TARGET_AMOUNT}`,
        'targetAmount'
      );
    }

    const startDate = assertIsoDate(input.startDate, 'startDate');
    const endDate =
      input.endDate == null ? null : assertIsoDate(input.endDate, 'endDate');
    this.validateEndDate(startDate, endDate);

    return { name, targetAmount, startDate, endDate };
  }

  async getGoals(): Promise<GoalDTO[]> {
    return this.goalRepository.getGoals();
  }

  async getGoalById(id: string): Promise<GoalDTO | null> {
    return this.goalRepository.getGoalByPk(id);
  }

  async getGoalExpenses(goalId: string): Promise<ExpenseDTO[]> {
    return this.goalRepository.getGoalExpenses(goalId);
  }

  async createGoal(input: GoalServiceInput): Promise<GoalDTO> {
    return this.goalRepository.createGoal(this.validateAndNormalize(input));
  }

  async updateGoal(
    input: GoalServiceInput & { id: string }
  ): Promise<GoalDTO> {
    const data = this.validateAndNormalize(input);
    await this.assertGoalLinkable(input.id);

    return this.goalRepository.updateGoal(input.id, data);
  }

  async closeGoal(input: { id: string; endDate: string }): Promise<GoalDTO> {
    const goal = await this.goalRepository.getGoalByPk(input.id);
    if (!goal) {
      throw goalNotFound();
    }

    const endDate = assertIsoDate(input.endDate, 'endDate');
    this.validateEndDate(goal.startDate, endDate);

    return this.goalRepository.closeGoal(input.id, endDate);
  }

  async deleteGoal(id: string): Promise<boolean> {
    await this.assertGoalLinkable(id);

    return this.goalRepository.deleteGoal(id);
  }

  // Throws GOAL_NOT_FOUND when the goal doesn't exist or belongs to another user
  async assertGoalLinkable(goalId: string): Promise<GoalDTO> {
    const goal = await this.goalRepository.getGoalByPk(goalId);
    if (!goal) {
      throw goalNotFound();
    }

    return goal;
  }
}
