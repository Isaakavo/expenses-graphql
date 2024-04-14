import {
  addDays,
  addMonths,
  differenceInMonths,
  differenceInWeeks,
} from 'date-fns';
import { GraphQLError } from 'graphql';
import {
  adaptCard,
  adaptExpensesWithCard,
  adaptSingleIncome,
} from '../adapters/income-adapter.js';
import {
  FixedExpenseFrequency,
  MutationResolvers,
} from '../generated/graphql.js';
import { logger } from '../logger.js';
import { Card } from '../models/card.js';
import { Expense } from '../models/expense.js';
import { Income } from '../models/income.js';
import { Date as CustomDate } from '../scalars/date.js';
import {
  calculateNumberOfBiWeeklyWeeks,
  calculateNumberOfMonthWeeks,
} from '../utils/date-utils.js';
import {
  deleteElement,
  updateElement,
  upsertCategory,
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
    return adaptSingleIncome(newIncome);
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
    try {
      const { cardId, concept, total, comment, payBefore, category } = input;
      const {
        user: { userId },
      } = context;
      const conceptLengthMax = 100;

      // TODO improve error logic
      if (concept.length === 0) {
        logger.error('Concept is empty');
        throw new Error('Concept must not be empty');
      }

      if (total === 0 || total < 0) {
        logger.error('Total bad input');
        throw new Error('Total must not be negative or zero');
      }

      if (concept.length > conceptLengthMax) {
        logger.error('concept error');
        throw new Error(
          `Concept lenght must be lower than ${conceptLengthMax}`
        );
      }

      const card =
        cardId &&
        (await Card.findOne({
          where: {
            id: cardId,
            userId,
          },
        }));

      const categoryFinded = await upsertCategory(category);

      const serverDate = CustomDate.parseValue(new Date().toISOString());
      const parsedPayBefore = CustomDate.parseValue(payBefore);

      const newExpense = await Expense.create({
        userId,
        concept,
        total,
        categoryId: categoryFinded.id,
        cardId: card?.id,
        comments: comment,
        payBefore: parsedPayBefore,
        createdAt: serverDate,
        updatedAt: serverDate,
      });

      logger.info('Expense created');

      return adaptExpensesWithCard(newExpense, card, categoryFinded);
    } catch (error) {
      logger.error(`Error creating an expense ${error}`);
    }
  },
  // TODO add logic to handle weekly expenses
  createFixedExpense: async (_, { input }, context) => {
    const {
      cardId,
      concept,
      total,
      comment,
      payBefore,
      category,
      numberOfMonthsOrWeeks,
      frequency,
    } = input;

    const {
      user: { userId },
    } = context;

    let datePtr = CustomDate.parseValue(payBefore);
    const parsedStartDate = datePtr;
    const serverDate = CustomDate.parseValue(new Date().toISOString());
    const expensesArr = [];

    const card =
      cardId &&
      (await Card.findOne({
        where: {
          id: cardId,
          userId,
        },
      }));

    const categoryFinded = await upsertCategory(category);

    const numberOfExpenses =
      frequency === FixedExpenseFrequency.BIWEEKLY
        ? differenceInWeeks(
          calculateNumberOfBiWeeklyWeeks(
            parsedStartDate,
            numberOfMonthsOrWeeks
          ),
          datePtr
        )
        : differenceInMonths(
          calculateNumberOfMonthWeeks(parsedStartDate, numberOfMonthsOrWeeks),
          datePtr
        );

    if (numberOfExpenses >= 27 && frequency === FixedExpenseFrequency.BIWEEKLY) {
      throw Error(
        'Max of expenses reached, you can only create 27 expenses at once'
      );
    }

    if (numberOfExpenses >= 13 && frequency === FixedExpenseFrequency.MONTHLY) {
      throw Error(
        'Max of expenses reached, you can only create 12 expenses at once'
      );
    }

    for (let i = 0; i < numberOfExpenses; i++) {
      expensesArr.push({
        userId,
        concept,
        total,
        comments: comment,
        categoryId: categoryFinded.id,
        payBefore: datePtr,
        cardId: card?.id,
        createdAt: serverDate,
        updatedAt: serverDate,
      });
      datePtr =
        frequency === FixedExpenseFrequency.BIWEEKLY
          ? addDays(datePtr, 15)
          : addMonths(datePtr, 1);
    }

    const expensesList = await Expense.bulkCreate(expensesArr);
    logger.info(`${expensesList.length} Expenses were created ${frequency}`);

    return expensesList.map((expense) =>
      adaptExpensesWithCard(expense, card, categoryFinded)
    );
  },
  updateExpense: async (_, { input }, context) => {
    try {
      const {
        user: { userId },
      } = context;
      const { category, concept, id, payBefore, total, cardId, comment } =
        input;

      const categoryFinded = await upsertCategory(category);

      const parameters = cardId
        ? {
          payBefore,
          total,
          cardId,
          comments: comment,
          concept,
          categoryId: categoryFinded.id,
        }
        : {
          payBefore,
          total,
          comments: comment,
          concept,
          categoryId: categoryFinded.id,
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

      return adaptExpensesWithCard(updatedExpense[0], card, categoryFinded);
    } catch (error) {
      logger.error(`error deleting the expense ${error}`);
      throw error;
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
