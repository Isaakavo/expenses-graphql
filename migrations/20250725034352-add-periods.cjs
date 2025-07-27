'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    // Crear tabla Periods
    await queryInterface.createTable('periods', {
      id: {
        type: Sequelize.UUID,
        defaultValue: Sequelize.literal('gen_random_uuid()'),
        primaryKey: true,
      },
      user_id: {
        type: Sequelize.STRING,
        allowNull: false,
      },
      start_date: {
        type: Sequelize.DATE,
        allowNull: false,
      },
      end_date: {
        type: Sequelize.DATE,
        allowNull: false,
      },
      type: {
        type: Sequelize.ENUM('weekly', 'fortnightly', 'monthly', 'custom'),
        allowNull: false,
      },
      created_at: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.literal('CURRENT_TIMESTAMP'),
      },
      updated_at: {
        type: Sequelize.DATE,
      },
    });

    // Agregar columna a Income
    await queryInterface.addColumn('incomes', 'period_id', {
      type: Sequelize.UUID,
      allowNull: true, // se backfilleará
      references: {
        model: 'periods',
        key: 'id',
      },
    });

    // Agregar columna a Expense
    await queryInterface.addColumn('expenses', 'period_id', {
      type: Sequelize.UUID,
      allowNull: true, // se backfilleará
      references: {
        model: 'periods',
        key: 'id',
      },
    });
  },

  down: async (queryInterface, Sequelize) => {
    await queryInterface.removeColumn('incomes', 'period_id');
    await queryInterface.removeColumn('expenses', 'period_id');
    await queryInterface.dropTable('periods');
    await queryInterface.sequelize.query("DROP TYPE IF EXISTS enum_periods_type;");
  }
};
