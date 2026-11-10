'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.sequelize.transaction(async (transaction) => {
      await queryInterface.sequelize.query('SET LOCAL lock_timeout = \'5s\'', {
        transaction,
      });

      await queryInterface.createTable(
        'expense_recurrences',
        {
          id: {
            type: Sequelize.UUID,
            primaryKey: true,
            defaultValue: Sequelize.literal('gen_random_uuid()'),
          },
          user_id: {
            type: Sequelize.UUID,
            allowNull: false,
          },
          frequency: {
            type: Sequelize.STRING(10),
            allowNull: false,
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
        `ALTER TABLE expense_recurrences ADD CONSTRAINT expense_recurrences_frequency_check
           CHECK (frequency IN ('Monthly', 'Biweekly'))`,
        { transaction }
      );
      await queryInterface.addIndex('expense_recurrences', ['user_id'], {
        name: 'expense_recurrences_user_id_idx',
        transaction,
      });

      await queryInterface.addColumn(
        'expenses',
        'recurrence_id',
        {
          type: Sequelize.UUID,
          allowNull: true,
          references: { model: 'expense_recurrences', key: 'id' },
          onDelete: 'RESTRICT',
        },
        { transaction }
      );
      await queryInterface.addColumn(
        'expenses',
        'recurrence_index',
        { type: Sequelize.INTEGER, allowNull: true },
        { transaction }
      );
      await queryInterface.sequelize.query(
        `ALTER TABLE expenses ADD CONSTRAINT expenses_recurrence_index_check
           CHECK ((recurrence_id IS NULL) = (recurrence_index IS NULL))`,
        { transaction }
      );
      await queryInterface.addIndex('expenses', ['recurrence_id', 'recurrence_index'], {
        name: 'expenses_recurrence_idx',
        unique: true,
        transaction,
      });
    });
  },

  down: async (queryInterface) => {
    await queryInterface.sequelize.transaction(async (transaction) => {
      await queryInterface.removeIndex('expenses', 'expenses_recurrence_idx', { transaction });
      await queryInterface.sequelize.query(
        'ALTER TABLE expenses DROP CONSTRAINT IF EXISTS expenses_recurrence_index_check',
        { transaction }
      );
      await queryInterface.removeColumn('expenses', 'recurrence_index', { transaction });
      await queryInterface.removeColumn('expenses', 'recurrence_id', { transaction });
      await queryInterface.dropTable('expense_recurrences', { transaction });
    });
  },
};
