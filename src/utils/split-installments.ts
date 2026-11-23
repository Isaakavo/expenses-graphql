import type { SeriesTemplate } from '../service/expenses-service.js';
import { validationError } from './validation-error.js';
import { AMOUNT_SCALE, formatDecimal, parseDecimal } from './decimal.js';

const toNumber = (cents: bigint) => Number(formatDecimal(cents, AMOUNT_SCALE));

const sum = (values: bigint[]) => values.reduce((acc, value) => acc + value, 0n);

const boundary = (total: bigint, count: number, i: number) =>
  (total * BigInt(i)) / BigInt(count);

export const splitCents = (total: bigint, count: number): bigint[] =>
  Array.from(
    { length: count },
    (_, i) => boundary(total, count, i + 1) - boundary(total, count, i)
  );

const prorate = (total: bigint, parts: bigint[]): bigint[] => {
  const whole = sum(parts);
  const boundaries = parts.map((_, i) => {
    const reached = sum(parts.slice(0, i + 1));
    return (2n * total * reached + whole) / (2n * whole);
  });
  return boundaries.map((boundary, i) => boundary - (i === 0 ? 0n : boundaries[i - 1]));
};

export const seriesAmount = (template: SeriesTemplate) =>
  template.foreignAmount ? template.foreignAmount.amount : template.total;

export const splitSeriesTemplate = (
  template: SeriesTemplate,
  count: number
): SeriesTemplate[] => {
  const amount = seriesAmount(template);
  if (!Number.isFinite(amount) || parseDecimal(amount, AMOUNT_SCALE) < BigInt(count)) {
    throw validationError('total must be at least one cent per occurrence', 'total');
  }
  const parts = splitCents(parseDecimal(amount, AMOUNT_SCALE), count);
  const foreign = template.foreignAmount;
  if (!foreign) {
    return parts.map((cents) => ({ ...template, total: toNumber(cents) }));
  }
  const totals = foreign.fixedRate
    ? prorate(parseDecimal(template.total, AMOUNT_SCALE), parts).map(toNumber)
    : parts.map(() => template.total);
  return parts.map((cents, i) => ({
    ...template,
    total: totals[i],
    foreignAmount: { ...foreign, amount: toNumber(cents) },
  }));
};
