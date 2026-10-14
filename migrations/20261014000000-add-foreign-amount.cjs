'use strict';

const snapshot = async (queryInterface, transaction) => {
  const [[row]] = await queryInterface.sequelize.query(
    `SELECT
       COUNT(*)::int AS expenses_count,
       COALESCE(SUM(total::numeric), 0)::text AS expenses_total,
       md5(COALESCE(string_agg(id::text || ':' || total::text || ':' || pay_before::text || ':' || currency, ',' ORDER BY id), '')) AS expenses_checksum
     FROM expenses`,
    { transaction }
  );
  return row;
};

const CONSTRAINTS = [
  'expenses_original_pair_check',
  'expenses_original_currency_check',
  'expenses_original_differs_check',
  'expenses_original_total_check',
  'expenses_no_original_check',
  'expenses_original_rate_check',
  'expenses_exchange_rate_check',
];

module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.sequelize.transaction(async (transaction) => {
      await queryInterface.sequelize.query('SET LOCAL lock_timeout = \'5s\'', {
        transaction,
      });
      const before = await snapshot(queryInterface, transaction);

      await queryInterface.addColumn(
        'expenses',
        'original_total',
        { type: Sequelize.DECIMAL(12, 2), allowNull: true },
        { transaction }
      );
      await queryInterface.addColumn(
        'expenses',
        'original_currency',
        { type: Sequelize.CHAR(3), allowNull: true },
        { transaction }
      );
      await queryInterface.addColumn(
        'expenses',
        'exchange_rate',
        { type: Sequelize.DECIMAL(18, 10), allowNull: true },
        { transaction }
      );
      await queryInterface.addColumn(
        'expenses',
        'rate_date',
        { type: Sequelize.DATEONLY, allowNull: true },
        { transaction }
      );
      await queryInterface.addColumn(
        'expenses',
        'rate_source',
        { type: Sequelize.STRING(20), allowNull: true },
        { transaction }
      );
      await queryInterface.addColumn(
        'expenses',
        'fixed_rate',
        { type: Sequelize.BOOLEAN, allowNull: false, defaultValue: false },
        { transaction }
      );

      await queryInterface.sequelize.query(
        `ALTER TABLE expenses
           ADD CONSTRAINT expenses_original_pair_check
             CHECK ((original_total IS NULL) = (original_currency IS NULL)),
           ADD CONSTRAINT expenses_original_currency_check
             CHECK (original_currency IS NULL OR original_currency ~ '^[A-Z]{3}$'),
           ADD CONSTRAINT expenses_original_differs_check
             CHECK (original_currency IS NULL OR original_currency <> currency),
           ADD CONSTRAINT expenses_original_total_check
             CHECK (original_total IS NULL OR original_total > 0),
           ADD CONSTRAINT expenses_no_original_check
             CHECK (original_total IS NOT NULL OR (
               exchange_rate IS NULL AND rate_date IS NULL AND rate_source IS NULL AND fixed_rate = false)),
           ADD CONSTRAINT expenses_original_rate_check
             CHECK (original_total IS NULL OR (
               exchange_rate IS NOT NULL AND rate_date IS NOT NULL AND rate_source IS NOT NULL)),
           ADD CONSTRAINT expenses_exchange_rate_check
             CHECK (exchange_rate IS NULL OR exchange_rate > 0)`,
        { transaction }
      );

      const after = await snapshot(queryInterface, transaction);
      Object.keys(before).forEach((key) => {
        if (before[key] !== after[key]) {
          throw new Error(
            `Foreign amount migration changed ${key}: ${before[key]} -> ${after[key]}`
          );
        }
      });
    });
  },

  down: async (queryInterface) => {
    await queryInterface.sequelize.transaction(async (transaction) => {
      await queryInterface.sequelize.query('SET LOCAL lock_timeout = \'5s\'', {
        transaction,
      });
      await queryInterface.sequelize.query(
        CONSTRAINTS.map(
          (name) => `ALTER TABLE expenses DROP CONSTRAINT IF EXISTS ${name};`
        ).join('\n'),
        { transaction }
      );
      await queryInterface.sequelize.query(
        `ALTER TABLE expenses
           DROP COLUMN fixed_rate,
           DROP COLUMN rate_source,
           DROP COLUMN rate_date,
           DROP COLUMN exchange_rate,
           DROP COLUMN original_currency,
           DROP COLUMN original_total`,
        { transaction }
      );
    });
  },
};
