import {
  Income as GraphqlIncome,
  Expense as GraphqlExpense,
} from 'generated/graphql';
import { Income } from '../models/income';
import { calculateFortnight } from '../utils/calculate-fortnight.js';
import { Expense } from '../models/expense';
import { Tag } from 'models/tag';
import { Card } from 'models/card';

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

export function adaptExpensesWithTagsAndCard(
  x: Expense,
  tags: Tag[],
  card?: Card
): GraphqlExpense {
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
    card: card ? adaptCard(card) : null,
    tags: tags.map((y) => adaptTag(y)),
  };
}

export function adaptCard(card: Card) {
  return {
    id: card.id.toString(),
    userId: card.userId,
    number: card.number,
    bank: card.bank,
    cutDateDay: card.cutDateDay,
    limitPaymentDay: card.limitPaymentDay,
    creditLimit: card.creditLimit,
  };
}

export function adaptTag(tag: Tag) {
  return {
    id: tag.id.toString(),
    name: tag.name,
    createdAt: tag.createdAt,
    updatedAt: tag.updatedAt,
  };
}
