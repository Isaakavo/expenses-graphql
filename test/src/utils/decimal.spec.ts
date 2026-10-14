import {
  AMOUNT_SCALE,
  convertAmount,
  deriveRate,
  formatDecimal,
  invertRate,
  parseDecimal,
  RATE_SCALE,
} from '../../../src/utils/decimal.js';

const amount = (value: number | string) => parseDecimal(value, AMOUNT_SCALE);
const rate = (value: number | string) => parseDecimal(value, RATE_SCALE);
const converted = (original: string, fx: string) =>
  formatDecimal(convertAmount(amount(original), rate(fx)), AMOUNT_SCALE);

describe('parseDecimal', () => {
  it('rounds half-up instead of following float representation', () => {
    expect(formatDecimal(amount(1.005), AMOUNT_SCALE)).toBe('1.01');
    expect(formatDecimal(amount(0.285), AMOUNT_SCALE)).toBe('0.29');
    expect(formatDecimal(amount('480.00'), AMOUNT_SCALE)).toBe('480.00');
    expect(formatDecimal(amount(10), AMOUNT_SCALE)).toBe('10.00');
  });
});

describe('convertAmount', () => {
  it('rounds the .005 boundary up', () => {
    expect(converted('0.01', '18.5')).toBe('0.19');
    expect(converted('0.50', '18.01')).toBe('9.01');
    expect(converted('1.00', '0.005')).toBe('0.01');
    expect(converted('1.00', '0.0049999999')).toBe('0.00');
  });

  it('keeps large amounts exact', () => {
    expect(converted('9999999999.99', '18.4123456789')).toBe('184123456788.82');
  });
});

describe('invertRate and deriveRate', () => {
  it('inverts half-up at 10 decimals', () => {
    expect(formatDecimal(invertRate(rate('17.5')), RATE_SCALE)).toBe('0.0571428571');
    expect(formatDecimal(invertRate(rate('16.384')), RATE_SCALE)).toBe('0.0610351563');
  });

  it('derives the rate from the charged total', () => {
    expect(formatDecimal(deriveRate(amount('1800'), amount('100')), RATE_SCALE)).toBe('18.0000000000');
    expect(formatDecimal(deriveRate(amount('100'), amount('3')), RATE_SCALE)).toBe('33.3333333333');
  });
});
