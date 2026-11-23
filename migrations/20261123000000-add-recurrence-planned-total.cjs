'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.sequelize.transaction(async (transaction) => {
      await queryInterface.sequelize.query('SET LOCAL lock_timeout = \'5s\'', {
        transaction,
      });
      await queryInterface.addColumn(
        'expense_recurrences',
        'planned_total',
        { type: Sequelize.DECIMAL(12, 2), allowNull: true },
        { transaction }
      );
      await queryInterface.sequelize.query(
        `ALTER TABLE expense_recurrences ADD CONSTRAINT expense_recurrences_planned_total_check
           CHECK (planned_total IS NULL OR planned_total > 0)`,
        { transaction }
      );
    });
  },

  down: async (queryInterface) => {
    await queryInterface.removeColumn('expense_recurrences', 'planned_total');
  },
};
