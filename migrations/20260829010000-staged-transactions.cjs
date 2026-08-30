'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.createTable('staged_transactions', {
      id: {
        type: Sequelize.UUID,
        primaryKey: true,
      },
      user_id: {
        type: Sequelize.UUID,
        allowNull: false,
      },
      card_id: {
        type: Sequelize.UUID,
        allowNull: false,
        references: {
          model: 'Cards',
          key: 'id',
        },
        onDelete: 'CASCADE',
      },
      provider: {
        type: Sequelize.STRING,
        allowNull: false,
      },
      provider_transaction_id: {
        type: Sequelize.STRING,
        allowNull: false,
      },
      description: {
        type: Sequelize.STRING,
        allowNull: false,
      },
      total: {
        type: Sequelize.DECIMAL(12, 2),
        allowNull: false,
      },
      transaction_date: {
        type: Sequelize.DATE,
        allowNull: false,
      },
      provider_pending: {
        type: Sequelize.BOOLEAN,
        allowNull: false,
        defaultValue: false,
      },
      review_status: {
        type: Sequelize.STRING,
        allowNull: false,
        defaultValue: 'PENDING',
      },
      suggested_sub_category_id: {
        type: Sequelize.UUID,
        allowNull: true,
        references: {
          model: 'sub_categories',
          key: 'id',
        },
        onDelete: 'SET NULL',
      },
      suggested_period_id: {
        type: Sequelize.UUID,
        allowNull: true,
        references: {
          model: 'periods',
          key: 'id',
        },
        onDelete: 'SET NULL',
      },
      suggestion_source: {
        type: Sequelize.STRING,
        allowNull: true,
      },
      promoted_expense_id: {
        type: Sequelize.UUID,
        allowNull: true,
        references: {
          model: 'expenses',
          key: 'id',
        },
        onDelete: 'SET NULL',
      },
      raw_payload: {
        type: Sequelize.JSONB,
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

    await queryInterface.addConstraint('staged_transactions', {
      fields: ['card_id', 'provider_transaction_id'],
      type: 'unique',
      name: 'unique_staged_transaction_per_card',
    });
  },

  down: async (queryInterface) => {
    await queryInterface.dropTable('staged_transactions');
  },
};
