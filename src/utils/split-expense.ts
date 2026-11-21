import { GoalRole } from '../generated/graphql.js';
import type { ExpenseInput } from '../service/expenses-service.js';
import { validationError } from './validation-error.js';
import { AMOUNT_SCALE, formatDecimal, parseDecimal } from './decimal.js';

export type ReimbursableShare = { goalId: string; amount: number };

export type SplitExpense = { own: ExpenseInput | null; reimbursable: ExpenseInput };

const toNumber = (cents: bigint) => Number(formatDecimal(cents, AMOUNT_SCALE));

const parseShare = (amount: number, entered: bigint) => {
  if (!Number.isFinite(amount)) {
    throw validationError('reimbursable amount must be a number', 'reimbursable');
  }
  const share = parseDecimal(amount, AMOUNT_SCALE);
  if (share <= 0n || share > entered) {
    throw validationError(
      'reimbursable amount must be greater than 0 and at most the expense amount',
      'reimbursable'
    );
  }
  return share;
};

export const splitExpense = (
  input: ExpenseInput,
  { goalId, amount }: ReimbursableShare
): SplitExpense => {
  const foreign = input.foreignAmount;
  const entered = parseDecimal(foreign ? foreign.amount : input.total, AMOUNT_SCALE);
  const share = parseShare(amount, entered);
  const rest = entered - share;

  const totals = (() => {
    if (!foreign) return { share: toNumber(share), rest: toNumber(rest) };
    if (!foreign.fixedRate) return { share: input.total, rest: input.total };
    const total = parseDecimal(input.total, AMOUNT_SCALE);
    const shareTotal = (total * share + entered / 2n) / entered;
    return { share: toNumber(shareTotal), rest: toNumber(total - shareTotal) };
  })();

  const part = (cents: bigint, total: number): ExpenseInput => ({
    ...input,
    total,
    ...(foreign && { foreignAmount: { ...foreign, amount: toNumber(cents) } }),
  });

  return {
    own: rest > 0n ? part(rest, totals.rest) : null,
    reimbursable: {
      ...part(share, totals.share),
      goalId,
      goalRole: GoalRole.SPENDING,
    },
  };
};
