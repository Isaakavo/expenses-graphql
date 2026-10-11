import { GraphQLError } from 'graphql';
import { Op, Sequelize, Transaction } from 'sequelize';
import { logger } from '../logger.js';
import { adaptGoalDTO } from '../adapters/goal-adapter.js';
import { adaptRawListExpense } from '../adapters/expense-adapter.js';
import { ExpenseDTO, ExpenseWithCategoryRaw, GoalDTO } from '../dto/index.js';
import { Card, Category, Expense, Goal, SubCategory } from '../models/index.js';

const goalNotFound = () =>
  new GraphQLError('Goal not found', {
    extensions: { code: 'GOAL_NOT_FOUND' },
  });

export type GoalInput = {
  name: string;
  targetAmount: number;
  startDate: string;
  endDate?: string | null;
};

export class GoalRepository {
  userId: string;
  sequelize: Sequelize;

  constructor(userId: string, sequelize: Sequelize) {
    this.userId = userId;
    this.sequelize = sequelize;
  }

  async getGoals(): Promise<GoalDTO[]> {
    const goals = await Goal.findAll({
      where: { userId: this.userId },
      order: [['startDate', 'DESC']],
    });

    return goals.map((goal) => adaptGoalDTO(goal));
  }

  async getGoalByPk(id: string): Promise<GoalDTO | null> {
    const goal = await Goal.findOne({
      where: { id, userId: this.userId },
    });

    return goal ? adaptGoalDTO(goal) : null;
  }

  async createGoal(input: GoalInput): Promise<GoalDTO> {
    const goal = await Goal.create({
      ...input,
      userId: this.userId,
    });

    logger.info(`Created goal id ${goal.id} for user ${this.userId}`);

    return adaptGoalDTO(goal);
  }

  async updateGoal(id: string, input: Partial<GoalInput>): Promise<GoalDTO> {
    const [affected] = await Goal.update(input, {
      where: { id, userId: this.userId },
      validate: true,
    });

    if (affected === 0) {
      throw goalNotFound();
    }

    logger.info(`Updated goal id ${id} for user ${this.userId}`);

    return this.getGoalByPk(id);
  }

  async closeGoal(id: string, endDate: string): Promise<GoalDTO> {
    return this.updateGoal(id, { endDate });
  }

  // Unlinks the expenses (keeps them) and removes the goal in one transaction.
  // expenses.goal_id FK is ON DELETE RESTRICT, so the unlink must run first.
  async deleteGoal(id: string): Promise<boolean> {
    return this.sequelize.transaction(async (transaction: Transaction) => {
      await Expense.update(
        { goalId: null, goalRole: null },
        { where: { userId: this.userId, goalId: id }, transaction }
      );

      const deleted = await Goal.destroy({
        where: { id, userId: this.userId },
        transaction,
      });

      if (deleted === 0) {
        throw goalNotFound();
      }

      logger.info(`Deleted goal id ${id} for user ${this.userId}`);
      return true;
    });
  }

  // All the expenses linked to the goal, both CONTRIBUTION and SPENDING
  async getGoalExpenses(goalId: string): Promise<ExpenseDTO[]> {
    const expenses = (await Expense.findAll({
      where: { userId: this.userId, goalId },
      include: [
        {
          model: SubCategory,
          as: 'sub_category',
          include: [
            {
              model: Category,
              as: 'category',
              where: {
                [Op.or]: [{ userId: null }, { userId: this.userId }],
              },
            },
          ],
        },
        {
          model: Card,
          as: 'card',
        },
      ],
      order: [['payBefore', 'ASC']],
    })) as ExpenseWithCategoryRaw[];

    return adaptRawListExpense(expenses);
  }
}
