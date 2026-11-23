'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.sequelize.transaction(async (transaction) => {
      await queryInterface.sequelize.query('SET LOCAL lock_timeout = \'5s\'', {
        transaction,
      });

      await queryInterface.createTable(
        'savings_funds',
        {
          id: {
            type: Sequelize.UUID,
            primaryKey: true,
            defaultValue: Sequelize.literal('gen_random_uuid()'),
          },
          user_id: { type: Sequelize.UUID, allowNull: false },
          name: { type: Sequelize.STRING(100), allowNull: false },
          currency: { type: Sequelize.CHAR(3), allowNull: false },
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
        `ALTER TABLE savings_funds ADD CONSTRAINT savings_funds_currency_check
           CHECK (currency ~ '^[A-Z]{3}$')`,
        { transaction }
      );
      await queryInterface.addIndex('savings_funds', ['user_id'], {
        name: 'savings_funds_user_id_idx',
        transaction,
      });
      await queryInterface.sequelize.query(
        `INSERT INTO savings_funds (user_id, name, currency)
           SELECT users.user_id, 'Ahorros', COALESCE(settings.default_currency, 'USD')
           FROM (
             SELECT user_id FROM user_settings
             UNION SELECT user_id FROM goals
             UNION SELECT user_id FROM expenses
           ) users
           LEFT JOIN user_settings settings USING (user_id)
           WHERE users.user_id IS NOT NULL`,
        { transaction }
      );

      await queryInterface.addColumn(
        'goals',
        'kind',
        { type: Sequelize.STRING(16), allowNull: false, defaultValue: 'SAVINGS' },
        { transaction }
      );
      await queryInterface.addColumn(
        'goals',
        'fund_id',
        {
          type: Sequelize.UUID,
          allowNull: true,
          references: { model: 'savings_funds', key: 'id' },
          onDelete: 'RESTRICT',
        },
        { transaction }
      );
      await queryInterface.addColumn(
        'goals',
        'default_card_id',
        {
          type: Sequelize.UUID,
          allowNull: true,
          references: { model: 'Cards', key: 'id' },
          onDelete: 'SET NULL',
        },
        { transaction }
      );
      await queryInterface.changeColumn(
        'goals',
        'target_amount',
        { type: Sequelize.DECIMAL(12, 2), allowNull: true },
        { transaction }
      );
      await queryInterface.sequelize.query(
        `ALTER TABLE goals
           ADD CONSTRAINT goals_kind_check CHECK (kind IN ('SAVINGS', 'REIMBURSABLE')),
           ADD CONSTRAINT goals_kind_target_check CHECK ((kind = 'SAVINGS') = (target_amount IS NOT NULL)),
           ADD CONSTRAINT goals_kind_fund_check CHECK ((kind = 'REIMBURSABLE') = (fund_id IS NOT NULL))`,
        { transaction }
      );

      await queryInterface.createTable(
        'goal_reimbursements',
        {
          id: {
            type: Sequelize.UUID,
            primaryKey: true,
            defaultValue: Sequelize.literal('gen_random_uuid()'),
          },
          user_id: { type: Sequelize.UUID, allowNull: false },
          goal_id: {
            type: Sequelize.UUID,
            allowNull: false,
            references: { model: 'goals', key: 'id' },
            onDelete: 'CASCADE',
          },
          amount: { type: Sequelize.DECIMAL(12, 2), allowNull: false },
          received_on: { type: Sequelize.DATEONLY, allowNull: false },
          comment: { type: Sequelize.STRING(255), allowNull: true },
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
        `ALTER TABLE goal_reimbursements ADD CONSTRAINT goal_reimbursements_amount_check
           CHECK (amount > 0)`,
        { transaction }
      );
      await queryInterface.addIndex('goal_reimbursements', ['goal_id'], {
        name: 'goal_reimbursements_goal_id_idx',
        transaction,
      });
    });
  },

  down: async (queryInterface, Sequelize) => {
    await queryInterface.sequelize.transaction(async (transaction) => {
      const [[{ events }]] = await queryInterface.sequelize.query(
        'SELECT COUNT(*)::int AS events FROM goals WHERE kind = \'REIMBURSABLE\'',
        { transaction }
      );
      if (events !== 0) {
        throw new Error(`Delete the ${events} reimbursable goal(s) before reverting`);
      }
      await queryInterface.dropTable('goal_reimbursements', { transaction });
      await queryInterface.sequelize.query(
        `ALTER TABLE goals
           DROP CONSTRAINT IF EXISTS goals_kind_check,
           DROP CONSTRAINT IF EXISTS goals_kind_target_check,
           DROP CONSTRAINT IF EXISTS goals_kind_fund_check`,
        { transaction }
      );
      await queryInterface.changeColumn(
        'goals',
        'target_amount',
        { type: Sequelize.DECIMAL(12, 2), allowNull: false },
        { transaction }
      );
      await queryInterface.removeColumn('goals', 'default_card_id', { transaction });
      await queryInterface.removeColumn('goals', 'fund_id', { transaction });
      await queryInterface.removeColumn('goals', 'kind', { transaction });
      await queryInterface.dropTable('savings_funds', { transaction });
    });
  },
};
