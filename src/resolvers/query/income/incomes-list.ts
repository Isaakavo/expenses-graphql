import { GraphQLError } from 'graphql';
import { adaptSingleIncome } from '../../../adapters/index.js';
import { QueryResolvers } from '../../../generated/graphql.js';
import { logger } from '../../../logger.js';
import { Income } from '../../../models/index.js';
import { calcualteTotalByMonth } from '../../../utils/calculate-total.js';
import { sequelize } from '../../../database/client.js';
import { QueryTypes } from 'sequelize';
import { toCamelCaseDeep } from '../../../utils/case-convertion.js';
import { formatInTimeZone } from 'date-fns-tz';

interface IncomByMonth {
  total: number;
  month: Date;
  year: string;
  incomes: Income[];
}

export const incomesList: QueryResolvers['incomesList'] = async (
  _,
  __,
  context
) => {
  try {
    const {
      user: { userId },
    } = context;

    //TODO implement logic in the query to receive the order of filtering from the client
    const allIncomes = await Income.findAll({
      where: {
        userId,
      },
      order: [['paymentDate', 'DESC']],
    });    

    const results = (await sequelize.query(
      `
      SELECT
        DATE_TRUNC('month', "payment_date") AS month,
        EXTRACT(YEAR FROM payment_date) AS year,
        SUM(total) AS total,
        JSON_AGG(incomes.* ORDER BY payment_date DESC) AS incomes
      FROM incomes
      WHERE "user_id" = :userId
      GROUP BY month, year
      ORDER BY month DESC
    `,
      {
        replacements: { userId },
        type: QueryTypes.SELECT,
      }
    )) as IncomByMonth[];

    logger.info(`returning ${allIncomes.length} incomes`);    

    const grouped = toCamelCaseDeep(results).map((r) => {
      return {
        month: formatInTimeZone(new Date(r.month), 'UTC', 'MMMM'),
        year: r.year,
        total: r.total,
        incomes: r.incomes.map((x) => adaptSingleIncome(x)),
      };
    });

    logger.info(grouped[0].month);

    return {
      incomes: allIncomes.map((x) => adaptSingleIncome(x)),
      totalByMonth: calcualteTotalByMonth(allIncomes),
      groupedByMonth: grouped,
      total: allIncomes.reduce(
        (acumulator, currentValue) => acumulator + currentValue.total,
        0
      ),
    };
  } catch (error) {
    if (error instanceof GraphQLError) {
      logger.error(`Graphql Error incomes list ${error.message}`);
      throw error;
    }
    logger.error(`Error incomes list ${error}`);
  }
};
