import { QueryResolvers } from '../../../generated/graphql.js';
import { Income } from '../../../models/index.js';
import { findAllExpensesWithCards } from '../../../utils/expenses-utils.js';
import { whereByFornight } from '../../../utils/where-fortnight.js';

export const financialBalanceByFortnight: QueryResolvers['financialBalanceByFortnight'] =
  async (_, { input }, context) => {
    const { payBefore } = input;
    const {
      user: { userId },
    } = context;

    const whereExpenses = whereByFornight(userId, payBefore, 'payBefore');
    const whereIncome = whereByFornight(userId, payBefore, 'paymentDate');

    const allExpenses = findAllExpensesWithCards(whereExpenses);
    const income = await Income.findOne({ where: whereIncome });

    // TODO make this work with the new string type for totals
    // const debts = Number(
    //   (await allExpenses)
    //     .reduce(
    //       (accumulator, currentValue) => accumulator + currentValue.total,
    //       0
    //     )
    //     .toFixed(2)
    // );

    // const remaining = Number((income.total - debts).toFixed(2));

    return {
      debts: 0.0,
      remaining: 0.0,
    };
  };
