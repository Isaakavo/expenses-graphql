import {
  Income as GraphqlIncome,
  Expense as GraphqlExpense,
} from 'generated/graphql';
import { Income } from '../models/income';
import { calculateFortnight } from '../utils/calculate-fortnight.js';
import { Expense } from '../models/expense';
import { Tag } from 'models/tag';

export function adaptSingleIncome(x: Income): GraphqlIncome {
  return {
    id: x.id.toString(),
    userId: x.userId,
    total: x.total,
    comment: x.comment,
    paymentDate: {
      date: x.paymentDate,
      fortnight: calculateFortnight(x.paymentDate),
    },
    createdAt: x.createdAt,
  };
}

export function adaptExpensesWithTags(x: Expense, tags: Tag[]): GraphqlExpense {
  return {
    id: x.id.toString(),
    concept: x.concept,
    payBefore: x.payBefore,
    total: x.total,
    userId: x.userId,
    comment: x.comments,
    createdAt: x.createdAt,
    incomeId: x.incomeId.toString(),
    updatedAt: x.updatedAt,
    tags: tags.map((y) => ({
      id: y.id.toString(),
      name: y.name,
      createdAt: y.createdAt,
      updatedAt: y.updatedAt,
    })),
  };
}
