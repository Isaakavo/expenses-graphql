export const AMOUNT_SCALE = 2;
export const RATE_SCALE = 10;

const pow10 = (exponent: number) => 10n ** BigInt(exponent);

const divideRounded = (numerator: bigint, denominator: bigint) =>
  (2n * numerator + denominator) / (2n * denominator);

const rescale = (value: bigint, from: number, to: number) =>
  to >= from
    ? value * pow10(to - from)
    : divideRounded(value, pow10(from - to));

// toFixed(10) absorbs the binary noise of numbers such as 1.005
export const parseDecimal = (value: number | string, scale: number): bigint => {
  const text = typeof value === 'number' ? value.toFixed(RATE_SCALE) : value.trim();
  const [whole, fraction = ''] = text.split('.');
  return rescale(BigInt(whole + fraction), fraction.length, scale);
};

export const formatDecimal = (value: bigint, scale: number): string => {
  const digits = value.toString().padStart(scale + 1, '0');
  return `${digits.slice(0, digits.length - scale)}.${digits.slice(digits.length - scale)}`;
};

export const invertRate = (rate: bigint): bigint =>
  divideRounded(pow10(2 * RATE_SCALE), rate);

export const convertAmount = (amount: bigint, rate: bigint): bigint =>
  divideRounded(amount * rate, pow10(RATE_SCALE));

export const deriveRate = (total: bigint, original: bigint): bigint =>
  divideRounded(total * pow10(RATE_SCALE), original);
