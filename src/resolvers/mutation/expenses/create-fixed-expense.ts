import {
  addDays,
  addMonths,
  differenceInMonths,
  differenceInWeeks,
} from 'date-fns';
import {
  adaptExpensesWithCard,
  categoryAdapter,
} from '../../../adapters/index.js';
import {
  FixedExpenseFrequency,
  MutationResolvers,
} from '../../../generated/graphql.js';
import { logger } from '../../../logger.js';
import { Card, Expense } from '../../../models/index.js';
import { Date as CustomDate } from '../../../scalars/date.js';
import {
  calculateNumberOfBiWeeklyWeeks,
  calculateNumberOfMonthWeeks,
} from '../../../utils/date-utils.js';

export const createFixedExpense: MutationResolvers['createFixedExpense'] =
  async (_, { input }, context) => {
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

    for (let i = 0; i < numberOfExpenses; i++) {
      expensesArr.push({
        userId,
        concept,
        total,
        comments: comment,
        category: categoryAdapter(category),
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

    return expensesList.map((expense) => adaptExpensesWithCard(expense, card));
  };
