'use strict';

const MXN_BOUNDARY = '2025-04-01 00:00:00+00';

const snapshot = async (queryInterface, transaction) => {
  const [[row]] = await queryInterface.sequelize.query(
    `SELECT
       (SELECT COUNT(*) FROM expenses)::int AS expenses_count,
       (SELECT COALESCE(SUM(total::numeric), 0) FROM expenses)::text AS expenses_total,
       (SELECT md5(COALESCE(string_agg(id::text || ':' || total::text || ':' || pay_before::text, ',' ORDER BY id), '')) FROM expenses) AS expenses_checksum,
       (SELECT COUNT(*) FROM incomes)::int AS incomes_count,
       (SELECT COALESCE(SUM(total::numeric), 0) FROM incomes)::text AS incomes_total,
       (SELECT md5(COALESCE(string_agg(id::text || ':' || total::text || ':' || payment_date::text, ',' ORDER BY id), '')) FROM incomes) AS incomes_checksum`,
    { transaction }
  );
  return row;
};

module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.sequelize.transaction(async (transaction) => {
      await queryInterface.sequelize.query('SET LOCAL lock_timeout = \'5s\'', {
        transaction,
      });
      const before = await snapshot(queryInterface, transaction);

      await queryInterface.addColumn(
        'expenses',
        'currency',
        { type: Sequelize.CHAR(3), allowNull: false, defaultValue: 'USD' },
        { transaction }
      );
      await queryInterface.addColumn(
        'incomes',
        'currency',
        { type: Sequelize.CHAR(3), allowNull: false, defaultValue: 'USD' },
        { transaction }
      );
      await queryInterface.addColumn(
        'Cards',
        'currency',
        { type: Sequelize.CHAR(3), allowNull: true },
        { transaction }
      );

      await queryInterface.sequelize.query(
        `UPDATE expenses SET currency = 'MXN' WHERE pay_before < '${MXN_BOUNDARY}'`,
        { transaction }
      );
      await queryInterface.sequelize.query(
        `UPDATE incomes SET currency = 'MXN' WHERE payment_date < '${MXN_BOUNDARY}'`,
        { transaction }
      );
      await queryInterface.sequelize.query(
        `UPDATE "Cards" SET currency = 'MXN'
         WHERE bank ~* '^(banregio|bbva|hey|liverpool|santander)'`,
        { transaction }
      );
      await queryInterface.sequelize.query(
        `UPDATE "Cards" SET currency = 'USD'
         WHERE bank ~* '^(bank of america|bofa|wells fargo|chase)'`,
        { transaction }
      );

      const [unmatched] = await queryInterface.sequelize.query(
        'SELECT id, bank FROM "Cards" WHERE currency IS NULL',
        { transaction }
      );
      unmatched.forEach((card) =>
        // eslint-disable-next-line no-console, no-undef
        console.warn(
          `Currency migration: card ${card.id} (${card.bank}) left without currency`
        )
      );

      await queryInterface.sequelize.query(
        `ALTER TABLE expenses ADD CONSTRAINT expenses_currency_check
           CHECK (currency ~ '^[A-Z]{3}$');
         ALTER TABLE incomes ADD CONSTRAINT incomes_currency_check
           CHECK (currency ~ '^[A-Z]{3}$');
         ALTER TABLE "Cards" ADD CONSTRAINT cards_currency_check
           CHECK (currency IS NULL OR currency ~ '^[A-Z]{3}$');`,
        { transaction }
      );

      await queryInterface.createTable(
        'user_settings',
        {
          user_id: { type: Sequelize.UUID, primaryKey: true },
          default_currency: {
            type: Sequelize.CHAR(3),
            allowNull: false,
            defaultValue: 'USD',
          },
          created_at: {
            type: Sequelize.DATE,
            allowNull: false,
            defaultValue: Sequelize.fn('NOW'),
          },
          updated_at: {
            type: Sequelize.DATE,
            allowNull: false,
            defaultValue: Sequelize.fn('NOW'),
          },
        },
        { transaction }
      );
      await queryInterface.sequelize.query(
        `ALTER TABLE user_settings ADD CONSTRAINT user_settings_default_currency_check
           CHECK (default_currency ~ '^[A-Z]{3}$')`,
        { transaction }
      );

      const after = await snapshot(queryInterface, transaction);
      Object.keys(before).forEach((key) => {
        if (before[key] !== after[key]) {
          throw new Error(
            `Currency migration changed ${key}: ${before[key]} -> ${after[key]}`
          );
        }
      });

      const [mixed] = await queryInterface.sequelize.query(
        `SELECT period_id FROM (
           SELECT period_id, currency FROM expenses
           UNION ALL
           SELECT period_id, currency FROM incomes
         ) rows
         GROUP BY period_id
         HAVING COUNT(DISTINCT currency) > 1`,
        { transaction }
      );
      if (mixed.length > 0) {
        throw new Error(
          `Currency migration found ${mixed.length} period(s) mixing currencies: ${mixed
            .map((row) => row.period_id)
            .join(', ')}`
        );
      }
    });
  },

  down: async (queryInterface) => {
    await queryInterface.sequelize.transaction(async (transaction) => {
      await queryInterface.dropTable('user_settings', { transaction });
      await queryInterface.sequelize.query(
        `ALTER TABLE "Cards" DROP CONSTRAINT IF EXISTS cards_currency_check;
         ALTER TABLE incomes DROP CONSTRAINT IF EXISTS incomes_currency_check;
         ALTER TABLE expenses DROP CONSTRAINT IF EXISTS expenses_currency_check;`,
        { transaction }
      );
      await queryInterface.removeColumn('Cards', 'currency', { transaction });
      await queryInterface.removeColumn('incomes', 'currency', { transaction });
      await queryInterface.removeColumn('expenses', 'currency', { transaction });
    });
  },
};
