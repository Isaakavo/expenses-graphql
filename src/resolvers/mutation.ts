import { GraphQLError } from 'graphql';
import { categoryAdapter } from '../adapters/category-adapter.js';
import {
  adaptCard,
  adaptExpensesWithCard,
  adaptSingleIncome,
} from '../adapters/income-adapter.js';
import { MutationResolvers } from '../generated/graphql.js';
import { logger } from '../logger.js';
import { Card } from '../models/card.js';
import { Expense } from '../models/expense.js';
import { Income } from '../models/income.js';
import { Date as CustomDate } from '../scalars/date.js';
import { calculateFortnight } from '../utils/calculate-fortnight.js';
import {
  deleteElement,
  updateElement,
  validateId,
} from '../utils/sequilize-utils.js';

//TODO add mutation for deletion
const mutations: MutationResolvers = {
  //TODO implement logic to handle the create of incomes for 1 year
  // add a new flag to indicate if the mutation should create 12 new incomes with the provided inputs
  createIncome: async (_, { input }, context) => {
    const { total, paymentDate, comment } = input;
    const {
      user: { userId },
    } = context;

    const parsedPaymentDay = CustomDate.parseValue(paymentDate);
    const parsedCreatedAt = CustomDate.parseValue(new Date().toISOString());

    const newIncome = await Income.create({
      userId,
      total,
      comment: comment?.trim() ?? '',
      paymentDate: parsedPaymentDay,
      createdAt: parsedCreatedAt,
    });

    logger.info(`Income added with id ${newIncome.id}`);
    return {
      id: newIncome.id.toString(),
      userId: newIncome.userId,
      total: newIncome.total,
      paymentDate: {
        date: newIncome.paymentDate,
        fortnight: calculateFortnight(parsedPaymentDay),
      },
      createdAt: newIncome.createdAt,
    };
  },
  updateIncome: async (_, { input }, context) => {
    const {
      user: { userId },
    } = context;
    const { incomeId, total, paymentDate, comment } = input;

    const updateParams = {
      total,
      comment: comment?.trim() ?? '',
      paymentDate: CustomDate.parseValue(paymentDate),
      updatedAt: CustomDate.parseValue(new Date().toISOString()),
    };

    const updatedIncome = await updateElement(
      Income,
      userId,
      incomeId,
      updateParams
    );

    return adaptSingleIncome(updatedIncome[0] as Income);
  },
  deleteIncomeById: async (_, input, context) => {
    try {
      const { id } = input;
      const {
        user: { userId },
      } = context;

      await validateId(Income, userId, id);

      return deleteElement(Income, userId, id);
    } catch (error) {
      logger.error(error);
      return error;
    }
  },
  createExpense: async (_, { input }, context) => {
    const { cardId, concept, total, comment, payBefore, category } = input;
    const {
      user: { userId },
    } = context;

    const card =
      cardId &&
      (await Card.findOne({
        where: {
          id: cardId,
          userId,
        },
      }));

    const serverDate = CustomDate.parseValue(new Date().toISOString());
    const parsedPayBefore = CustomDate.parseValue(payBefore);

    const newExpense = await Expense.create({
      userId,
      concept,
      total,
      category: categoryAdapter(category),
      cardId: card?.id,
      comments: comment,
      payBefore: parsedPayBefore,
      createdAt: serverDate,
      updatedAt: serverDate,
    });

    logger.info('Expense created');

    return {
      id: newExpense.id.toString(),
      incomeId: 'pito',
      userId: newExpense.userId,
      concept: newExpense.concept,
      category,
      total: newExpense.total,
      comment: newExpense.comments,
      payBefore: newExpense.payBefore,
      createdAt: newExpense.createdAt,
      updatedAt: newExpense.updatedAt,
      card: card && adaptCard(card),
    };
  },
  updateExpense: async (_, { input }, context) => {
    try {
      const {
        user: { userId },
      } = context;
      const { category, concept, id, payBefore, total, cardId, comment } =
        input;

      const parameters = {
        payBefore,
        total,
        cardId,
        comments: comment,
        concept,
        category,
      };

      const updatedExpense = (await updateElement(
        Expense,
        userId,
        id,
        parameters
      )) as Expense[];

      const card = await Card.findOne({
        where: { userId, id: updatedExpense[0].cardId },
      });

      return adaptExpensesWithCard(updatedExpense[0], card);
    } catch (error) {
      logger.error(error);
      return error;
    }
  },
  deleteExpense: async (_, { id }, context) => {
    try {
      const {
        user: { userId },
      } = context;

      await validateId(Expense, userId, id);

      return deleteElement(Expense, userId, id);
    } catch (error) {
      logger.error(error);
      return error;
    }
  },
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
