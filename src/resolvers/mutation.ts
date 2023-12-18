import { GraphQLError } from 'graphql';
import { categoryAdapter } from '../adapters/category-adapter.js';
import { adaptCard } from '../adapters/income-adapter.js';
import { MutationResolvers } from '../generated/graphql.js';
import { logger } from '../logger.js';
import { Card } from '../models/card.js';
import { Expense } from '../models/expense.js';
import { Income } from '../models/income.js';
import { Date as CustomDate } from '../scalars/date.js';
import { calculateFortnight } from '../utils/calculate-fortnight.js';

//TODO add mutation for deletion
const mutations: MutationResolvers = {
  //TODO implement logic to handle the create of incomes for 1 year
  // add a new flag to indicate if the mutation should create 12 new incomes with the provided inputs
  createIncome: async (_, input, context) => {
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
  deleteIncomeById: async (_, input, context) => {
    try {
      const { id } = input;
      const {
        user: { userId },
      } = context;

      const incomeToDelete = await Income.findOne({
        where: {
          userId,
          id,
        },
      });

      if (!incomeToDelete) {
        throw new GraphQLError('Income id not found', {
          extensions: {
            code: 'NOT_FOUND',
            http: { status: 404 },
          },
        });
      }

      const isDeleted = await Income.destroy({
        where: {
          userId,
          id,
        },
      });

      if (isDeleted === 0) {
        return false;
      }

      return true;
    } catch (error) {
      if (error instanceof GraphQLError) {
        logger.error(`Error deleting income by id ${error.message}`);
        throw error;
      }
    }
  },
};

export default mutations;
