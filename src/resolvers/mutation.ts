import { GraphQLError } from 'graphql';
import { MutationResolvers } from '../generated/graphql.js';
import { ExpenseTags } from '../models/expense-tags.js';
import { Expense } from '../models/expense.js';
import { Income } from '../models/income.js';
import { Tag } from '../models/tag.js';
import { Date as CustomDate } from '../scalars/date.js';
import { calculateFortnight } from '../utils/calculate-fortnight.js';
import { Card } from '../models/card.js';

//TODO add mutation for deletion
const mutations: MutationResolvers = {
  createIncome: async (_, input, context) => {
    const { total, paymentDate, comment } = input;
    const { user } = context;
    const { userId } = await user();

    const parsedPaymentDay = CustomDate.parseValue(paymentDate);
    const parsedCreatedAt = CustomDate.parseValue(new Date().toISOString());

    const newIncome = await Income.create({
      userId,
      total,
      comment: comment.trim(),
      paymentDate: parsedPaymentDay,
      createdAt: parsedCreatedAt,
    });

    console.log('Income added with id', newIncome.id);

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
    const { incomeId, concept, total, tags, comment, payBefore } = input;
    const { user } = context;
    const { userId } = await user();

    if (tags.length > 10) {
      throw new GraphQLError('No more than 10 tags per expense', {
        extensions: {
          code: 'BAD REQUEST',
          http: { status: 400 },
        },
      });
    }

    const serverDate = CustomDate.parseValue(new Date().toISOString());
    const parsedPayBefore = CustomDate.parseValue(payBefore);

    const newExpense = await Expense.create({
      userId,
      incomeId,
      concept,
      total,
      comments: comment,
      payBefore: parsedPayBefore,
      createdAt: serverDate,
      updatedAt: serverDate,
    });

    const newTags = await Promise.all(
      tags.map(async (tag) => {
        const [tagFindOrCreate, created] = await Tag.findOrCreate({
          where: { name: tag.name },
        });

        if (created) {
          console.log(`Find this tag ${tagFindOrCreate.name}`);
        }

        await ExpenseTags.create({
          expenseId: newExpense.id,
          tagId: tagFindOrCreate.id,
        });

        return tagFindOrCreate;
      })
    );

    console.log({ newExpense });

    return {
      id: newExpense.id.toString(),
      incomeId: newExpense.incomeId.toString(),
      userId: newExpense.userId,
      concept: newExpense.concept,
      total: newExpense.total,
      comment: newExpense.comments,
      payBefore: newExpense.payBefore,
      createdAt: newExpense.createdAt,
      updatedAt: newExpense.updatedAt,
      tags: newTags.map((tag) => {
        return {
          id: tag.id.toString(),
          name: tag.name,
          createdAt: tag.createdAt,
          updatedAt: tag.updatedAt,
        };
      }),
    };
  },
  createCard: async (_, { input }, context) => {
    try {
      const { cutDateDay, limitPaymentDay, creditLimit, number, bank } = input;
      const { user } = context;
      const { userId } = await user();

      if (!bank) {
        throw new GraphQLError('You need to pass a bank value');
      }

      if (number.length > 4) {
        throw new GraphQLError(
          'Should only put the last 4 numbers of the card'
        );
      }

      if (Number(cutDateDay) < 1 || Number(cutDateDay) > 31) {
        throw new GraphQLError('cutDate is not a valid date');
      }

      if (Number(limitPaymentDay) < 1 || Number(limitPaymentDay) > 31) {
        throw new GraphQLError('limitPaymentDay is not a valid date');
      }

      const newCard = await Card.create({
        userId,
        number,
        bank,
        cutDateDay,
        limitPaymentDay,
        creditLimit,
      });

      return {
        id: newCard.id.toString(),
        userId: newCard.userId,
        number: newCard.number,
        bank: newCard.bank,
        cutDateDay: newCard.cutDateDay,
        limitPaymentDay: newCard.limitPaymentDay,
        creditLimit: newCard.creditLimit,
      };
    } catch (error) {
      console.error(error);
      throw error;
    }
  },
  //TODO when deleting I need to also delete all the expenses associated to this income?
  // think in a way of do cascading delete
  deleteIncomeById: async (_, input, context) => {
    try {
      const { id } = input;
      const { user } = context;
      const { userId } = await user();

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

      console.log({ isDeleted });

      if (isDeleted === 0) {
        return false;
      }

      return true;
    } catch (error) {
      if (error instanceof GraphQLError) {
        console.log(error);
        throw error;
      }
    }
  },
};

export default mutations;
