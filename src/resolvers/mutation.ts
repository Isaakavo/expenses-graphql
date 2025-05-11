import { GraphQLError } from 'graphql';
import {
  adaptCard,
} from '../adapters/income-adapter.js';
import { MutationResolvers } from '../generated/graphql.js';
import { logger } from '../logger.js';
import { Card } from '../models/card.js';
import {
  deleteElement,
  updateElement,
  validateId,
} from '../utils/sequilize-utils.js';
import {
  createExpense,
  createFixedExpense,
  createIncome,
  deleteExpense,
  deleteIncomeById,
  updateExpense,
  updateIncome,
} from './mutations/index.js';

//TODO add mutation for deletion
const mutations: MutationResolvers = {
  createIncome,
  updateIncome,
  deleteIncomeById,
  createExpense,
  // TODO add logic to handle weekly expenses
  createFixedExpense,
  updateExpense,
  deleteExpense,
  createCard: async (_, { input }, context) => {
    try {
      const { alias, bank, isDigital, isDebit } = input;
      const {
        user: { userId },
      } = context;

      if (!bank) {
        throw new GraphQLError('You need to pass a bank value');
      }

      const newCard = await Card.create({
        userId,
        alias,
        bank,
        isDebit,
        isDigital,
      });

      return adaptCard(newCard);
    } catch (error) {
      logger.error(`Error creating card ${error.message}`);
      throw error;
    }
  },
  updateCard: async (_, { input }, context) => {
    try {
      const {
        user: { userId },
      } = context;
      const { bank, id, alias, isDebit, isDigital } = input;

      const updatedCard = await updateElement(Card, userId, id, {
        bank,
        alias,
        isDebit,
        isDigital,
      });

      return adaptCard(updatedCard[0] as Card);
    } catch (error) {
      logger.error(error);
      return error;
    }
  },
  deleteCard: async (_, { id }, context) => {
    try {
      const {
        user: { userId },
      } = context;

      await validateId(Card, userId, id);

      return deleteElement(Card, userId, id);
    } catch (error) {
      logger.error(error);
      return error;
    }
  },
};

export default mutations;
