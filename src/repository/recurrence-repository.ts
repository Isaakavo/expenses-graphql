import { Sequelize, Transaction } from 'sequelize';
import { FixedExpenseFrequency } from '../generated/graphql.js';
import { ExpenseRecurrence } from '../models/index.js';

type TransactionOptions = { transaction?: Transaction };

export class RecurrenceRepository {
  userId: string;
  sequelizeClient: Sequelize;

  constructor(userId: string, sequelizeClient?: Sequelize) {
    this.userId = userId;
    this.sequelizeClient = sequelizeClient;
  }

  async create(frequency: FixedExpenseFrequency, options: TransactionOptions = {}) {
    return ExpenseRecurrence.create(
      { userId: this.userId, frequency },
      { transaction: options.transaction }
    );
  }

  async findById(id: string, options: TransactionOptions = {}) {
    return ExpenseRecurrence.findOne({
      where: { id, userId: this.userId },
      transaction: options.transaction,
    });
  }

  async updateFrequency(
    id: string,
    frequency: FixedExpenseFrequency,
    options: TransactionOptions = {}
  ) {
    await ExpenseRecurrence.update(
      { frequency },
      { where: { id, userId: this.userId }, transaction: options.transaction }
    );
  }

  async delete(id: string, options: TransactionOptions = {}) {
    await ExpenseRecurrence.destroy({
      where: { id, userId: this.userId },
      transaction: options.transaction,
    });
  }
}
