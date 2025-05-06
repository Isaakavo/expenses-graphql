import { Card } from '../models/card.js';
import { logger } from '../logger.js';
import { WhereOptions } from 'sequelize';

export class CardRepository {

  async findCardByUserId(userId: string, expenseId: string, where: WhereOptions = {}) {
    try {
      return Card.findOne({
        where: {
          ...where,
          id: expenseId,
          userId,
        },
      });
    } catch (error) {
      logger.error(`Error finding cards and tags ${error.message}`);
    }
  }
}
