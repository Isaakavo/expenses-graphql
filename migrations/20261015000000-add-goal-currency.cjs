'use strict';

const snapshot = async (queryInterface, transaction) => {
  const [[row]] = await queryInterface.sequelize.query(
    `SELECT
       (SELECT COUNT(*) FROM goals)::int AS goals_count,
       (SELECT md5(COALESCE(string_agg(id::text || ':' || name || ':' || target_amount::text || ':' || start_date::text || ':' || COALESCE(end_date::text, ''), ',' ORDER BY id), '')) FROM goals) AS goals_checksum,
       (SELECT COUNT(*) FROM expenses)::int AS expenses_count,
       (SELECT md5(COALESCE(string_agg(id::text || ':' || total::text || ':' || COALESCE(goal_id::text, ''), ',' ORDER BY id), '')) FROM expenses) AS expenses_checksum`,
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
        'goals',
        'currency',
        { type: Sequelize.CHAR(3), allowNull: false, defaultValue: 'USD' },
        { transaction }
      );
      await queryInterface.sequelize.query(
        `ALTER TABLE goals ADD CONSTRAINT goals_currency_check
           CHECK (currency ~ '^[A-Z]{3}$')`,
        { transaction }
      );

      const after = await snapshot(queryInterface, transaction);
      Object.keys(before).forEach((key) => {
        if (before[key] !== after[key]) {
          throw new Error(
            `Goal currency migration changed ${key}: ${before[key]} -> ${after[key]}`
          );
        }
      });

      const [[{ not_usd: notUsd }]] = await queryInterface.sequelize.query(
        'SELECT COUNT(*)::int AS not_usd FROM goals WHERE currency <> \'USD\'',
        { transaction }
      );
      if (notUsd !== 0) {
        throw new Error(`Goal currency migration left ${notUsd} goal(s) not in USD`);
      }
    });
  },

  down: async (queryInterface) => {
    await queryInterface.sequelize.transaction(async (transaction) => {
      await queryInterface.sequelize.query(
        'ALTER TABLE goals DROP CONSTRAINT IF EXISTS goals_currency_check',
        { transaction }
      );
      await queryInterface.removeColumn('goals', 'currency', { transaction });
    });
  },
};
