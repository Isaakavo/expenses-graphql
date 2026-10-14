'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.sequelize.transaction(async (transaction) => {
      await queryInterface.createTable(
        'exchange_rates',
        {
          base: { type: Sequelize.CHAR(3), allowNull: false, primaryKey: true },
          quote: { type: Sequelize.CHAR(3), allowNull: false, primaryKey: true },
          rate_date: { type: Sequelize.DATEONLY, allowNull: false, primaryKey: true },
          rate: { type: Sequelize.DECIMAL(18, 8), allowNull: false },
          source: { type: Sequelize.STRING(20), allowNull: false },
          fetched_at: {
            type: Sequelize.DATE,
            allowNull: false,
            defaultValue: Sequelize.fn('NOW'),
          },
        },
        { transaction }
      );
      await queryInterface.sequelize.query(
        `ALTER TABLE exchange_rates
           ADD CONSTRAINT exchange_rates_base_check CHECK (base ~ '^[A-Z]{3}$'),
           ADD CONSTRAINT exchange_rates_quote_check CHECK (quote ~ '^[A-Z]{3}$'),
           ADD CONSTRAINT exchange_rates_rate_check CHECK (rate > 0)`,
        { transaction }
      );
    });
  },

  down: async (queryInterface) => {
    await queryInterface.dropTable('exchange_rates');
  },
};
