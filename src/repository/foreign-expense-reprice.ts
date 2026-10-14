import { QueryTypes, Sequelize } from 'sequelize';
import { logger } from '../logger.js';
import { Expense } from '../models/index.js';

// Rounding and the UTC date of pay_before must match ExpensesService, or a re-price would differ from a fresh conversion.
const REPRICE_SQL = `
  UPDATE expenses e
  SET exchange_rate = best.new_rate,
      rate_date = best.rate_date,
      total = ROUND(e.original_total * best.new_rate, 2),
      updated_at = NOW()
  FROM (
    SELECT x.id, x.original_currency, x.currency, r.rate_date,
           CASE WHEN r.base = x.original_currency THEN r.rate ELSE ROUND(1 / r.rate, 10) END AS new_rate
    FROM expenses x
    JOIN LATERAL (
      SELECT er.base, er.rate, er.rate_date
      FROM exchange_rates er
      WHERE ((er.base = x.original_currency AND er.quote = x.currency)
          OR (er.base = x.currency AND er.quote = x.original_currency))
        AND er.rate_date <= (x.pay_before AT TIME ZONE 'UTC')::date
      ORDER BY er.rate_date DESC
      LIMIT 1
    ) r ON true
    WHERE x.original_total IS NOT NULL
      AND x.fixed_rate = false
      AND x.rate_date < (x.pay_before AT TIME ZONE 'UTC')::date
  ) best
  WHERE e.id = best.id
    AND e.original_total IS NOT NULL
    AND e.fixed_rate = false
    AND e.original_currency = best.original_currency
    AND e.currency = best.currency
    AND best.rate_date > e.rate_date
    AND best.rate_date <= (e.pay_before AT TIME ZONE 'UTC')::date
  RETURNING e.id`;

export const repriceForeignExpenses = async (
  sequelize: Sequelize = Expense.sequelize
): Promise<number> => {
  const rows = await sequelize.transaction(async (transaction) => {
    await sequelize.query('SET LOCAL lock_timeout = \'2s\'', { transaction });
    return sequelize.query(REPRICE_SQL, { type: QueryTypes.SELECT, transaction });
  });
  if (rows.length > 0) {
    logger.info(`Re-priced ${rows.length} foreign expenses with newer exchange rates`);
  }
  return rows.length;
};
