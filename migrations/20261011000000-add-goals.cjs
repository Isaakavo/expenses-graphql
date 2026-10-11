'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.createTable('goals', {
      id: {
        type: Sequelize.UUID,
        primaryKey: true,
        defaultValue: Sequelize.literal('gen_random_uuid()'),
      },
      user_id: {
        type: Sequelize.UUID,
        allowNull: false,
      },
      name: {
        type: Sequelize.STRING(100),
        allowNull: false,
      },
      target_amount: {
        type: Sequelize.DECIMAL(12, 2),
        allowNull: false,
      },
      start_date: {
        type: Sequelize.DATEONLY,
        allowNull: false,
      },
      end_date: {
        type: Sequelize.DATEONLY,
        allowNull: true,
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
    });

    await queryInterface.addIndex('goals', ['user_id'], {
      name: 'goals_user_id_idx',
    });

    await queryInterface.addColumn('expenses', 'goal_id', {
      type: Sequelize.UUID,
      allowNull: true,
      references: {
        model: 'goals',
        key: 'id',
      },
      onDelete: 'RESTRICT',
    });

    await queryInterface.addColumn('expenses', 'goal_role', {
      type: Sequelize.ENUM('CONTRIBUTION', 'SPENDING'),
      allowNull: true,
    });

    await queryInterface.addIndex('expenses', ['goal_id'], {
      name: 'expenses_goal_id_idx',
    });

    // goal_id and goal_role must be both null or both set
    await queryInterface.sequelize.query(`
      ALTER TABLE expenses
      ADD CONSTRAINT expenses_goal_role_check
      CHECK ((goal_id IS NULL) = (goal_role IS NULL));
    `);
  },

  down: async (queryInterface) => {
    await queryInterface.sequelize.query(`
      ALTER TABLE expenses
      DROP CONSTRAINT IF EXISTS expenses_goal_role_check;
    `);
    await queryInterface.removeIndex('expenses', 'expenses_goal_id_idx');
    await queryInterface.removeColumn('expenses', 'goal_role');
    await queryInterface.removeColumn('expenses', 'goal_id');
    await queryInterface.sequelize.query(`
      DROP TYPE IF EXISTS enum_expenses_goal_role;
    `);
    await queryInterface.dropTable('goals');
  },
};
