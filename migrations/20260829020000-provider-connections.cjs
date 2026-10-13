'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.createTable('provider_connections', {
      id: {
        type: Sequelize.UUID,
        primaryKey: true,
      },
      user_id: {
        type: Sequelize.UUID,
        allowNull: false,
      },
      provider: {
        type: Sequelize.STRING,
        allowNull: false,
      },
      provider_connection_id: {
        type: Sequelize.STRING,
        allowNull: false,
      },
      sync_cursor: {
        type: Sequelize.TEXT,
        allowNull: true,
      },
      created_at: {
        type: Sequelize.DATE,
        allowNull: false,
      },
      updated_at: {
        type: Sequelize.DATE,
        allowNull: false,
      },
    });

    await queryInterface.addConstraint('provider_connections', {
      fields: ['provider', 'provider_connection_id'],
      type: 'unique',
      name: 'unique_provider_connection',
    });
  },

  down: async (queryInterface) => {
    await queryInterface.dropTable('provider_connections');
  },
};
