import { GraphQLError } from 'graphql';
import { Op, Sequelize, Transaction } from 'sequelize';
import { logger } from '../logger.js';
import {
  adaptGoalDTO,
  adaptGoalReimbursementDTO,
} from '../adapters/goal-adapter.js';
import { adaptRawListExpense } from '../adapters/expense-adapter.js';
import {
  ExpenseDTO,
  ExpenseWithCategoryRaw,
  GoalDTO,
  GoalReimbursementDTO,
} from '../dto/index.js';
import { CurrencyCode, GoalKind } from '../generated/graphql.js';
import {
  Card,
  Category,
  Expense,
  Goal,
  GoalReimbursement,
  SavingsFund,
  SubCategory,
} from '../models/index.js';

const goalNotFound = () =>
  new GraphQLError('Goal not found', {
    extensions: { code: 'GOAL_NOT_FOUND' },
  });

const reimbursementNotFound = () =>
  new GraphQLError('Reimbursement not found', {
    extensions: { code: 'REIMBURSEMENT_NOT_FOUND' },
  });

export type GoalInput = {
  name: string;
  kind?: GoalKind;
  targetAmount: number | null;
  startDate: string;
  endDate?: string | null;
  currency?: CurrencyCode;
  fundId?: string | null;
  defaultCardId?: string | null;
};

export type GoalReimbursementInput = {
  amount: number;
  receivedOn: string;
  comment: string | null;
};

const goalIncludes = [
  { model: SavingsFund, as: 'fund' },
  { model: Card, as: 'defaultCard' },
];

export type GoalLinkedExpenseRow = {
  id: string;
  total: string;
  currency: CurrencyCode;
  originalTotal: string | null;
  originalCurrency: CurrencyCode | null;
  payBefore: Date;
  goalCurrency: CurrencyCode;
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
      include: goalIncludes,
      order: [['startDate', 'DESC']],
    });

    return goals.map((goal) => adaptGoalDTO(goal));
  }

  async getGoalByPk(id: string): Promise<GoalDTO | null> {
    const goal = await Goal.findOne({
      where: { id, userId: this.userId },
      include: goalIncludes,
    });

    return goal ? adaptGoalDTO(goal) : null;
  }

  async createGoal(input: GoalInput): Promise<GoalDTO> {
    const goal = await Goal.create({
      ...input,
      userId: this.userId,
    });

    logger.info(`Created goal id ${goal.id} for user ${this.userId}`);

    return this.getGoalByPk(goal.id);
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

  // All the expenses linked to the goals, both CONTRIBUTION and SPENDING
  async getExpensesByGoalIds(
    goalIds: readonly string[]
  ): Promise<ExpenseDTO[]> {
    const expenses = (await Expense.findAll({
      where: { userId: this.userId, goalId: { [Op.in]: goalIds } },
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

  async getGoalLinkedExpenseRows(
    expenseIds: readonly string[]
  ): Promise<GoalLinkedExpenseRow[]> {
    const expenses = await Expense.findAll({
      where: {
        id: { [Op.in]: [...expenseIds] },
        userId: this.userId,
        goalId: { [Op.ne]: null },
      },
      include: [{ model: Goal, as: 'goal', required: true }],
    });

    return expenses.map((expense) => ({
      id: String(expense.id),
      total: String(expense.total),
      currency: expense.currency,
      originalTotal: expense.originalTotal ?? null,
      originalCurrency: expense.originalCurrency ?? null,
      payBefore: expense.payBefore,
      goalCurrency: (expense as unknown as { goal: Goal }).goal.currency,
    }));
  }

  async getReimbursementsByGoalIds(
    goalIds: readonly string[]
  ): Promise<GoalReimbursementDTO[]> {
    const reimbursements = await GoalReimbursement.findAll({
      where: { userId: this.userId, goalId: { [Op.in]: [...goalIds] } },
      order: [
        ['receivedOn', 'ASC'],
        ['createdAt', 'ASC'],
      ],
    });

    return reimbursements.map(adaptGoalReimbursementDTO);
  }

  async getReimbursementByPk(id: string): Promise<GoalReimbursementDTO | null> {
    const reimbursement = await GoalReimbursement.findOne({
      where: { id, userId: this.userId },
    });

    return reimbursement ? adaptGoalReimbursementDTO(reimbursement) : null;
  }

  async countReimbursements(goalId: string): Promise<number> {
    return GoalReimbursement.count({
      where: { goalId, userId: this.userId },
    });
  }

  async addReimbursement(
    goalId: string,
    input: GoalReimbursementInput
  ): Promise<GoalReimbursementDTO> {
    const reimbursement = await GoalReimbursement.create({
      ...input,
      goalId,
      userId: this.userId,
    });

    logger.info(
      `Created reimbursement id ${reimbursement.id} for goal ${goalId} and user ${this.userId}`
    );

    return adaptGoalReimbursementDTO(reimbursement);
  }

  async updateReimbursement(
    id: string,
    input: GoalReimbursementInput
  ): Promise<GoalReimbursementDTO> {
    const [affected] = await GoalReimbursement.update(input, {
      where: { id, userId: this.userId },
    });

    if (affected === 0) {
      throw reimbursementNotFound();
    }

    logger.info(`Updated reimbursement id ${id} for user ${this.userId}`);

    return this.getReimbursementByPk(id);
  }

  async deleteReimbursement(id: string): Promise<boolean> {
    const deleted = await GoalReimbursement.destroy({
      where: { id, userId: this.userId },
    });

    if (deleted === 0) {
      throw reimbursementNotFound();
    }

    logger.info(`Deleted reimbursement id ${id} for user ${this.userId}`);
    return true;
  }

  async cardExists(cardId: string): Promise<boolean> {
    return (await Card.count({ where: { id: cardId, userId: this.userId } })) > 0;
  }
}
