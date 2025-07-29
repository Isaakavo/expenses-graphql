'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    // 1. Crear tabla categories si no existe
    await queryInterface.createTable('categories', {
      id: {
        type: Sequelize.UUID,
        primaryKey: true,
        defaultValue: Sequelize.literal('gen_random_uuid()'),
      },
      user_id: {
        type: Sequelize.STRING,
        allowNull: true,
      },
      name: {
        type: Sequelize.STRING,
        unique: true,
        allowNull: false,
      },
      created_at: {
        type: Sequelize.DATE,
        allowNull: false,
      },
      updated_at: {
        type: Sequelize.DATE,
      },
    });

    // 2. Crear UserCategoryAllocationTemplate
    await queryInterface.createTable('user_category_allocation_templates', {
      id: {
        type: Sequelize.UUID,
        primaryKey: true,
        defaultValue: Sequelize.literal('gen_random_uuid()'),
      },
      user_id: {
        type: Sequelize.STRING,
        allowNull: false,
      },
      category_id: {
        type: Sequelize.UUID,
        allowNull: false,
        references: {
          model: 'categories',
          key: 'id',
        },
        onDelete: 'CASCADE',
      },
      percentage: {
        type: Sequelize.DECIMAL(5, 2),
        allowNull: false,
      },
      created_at: {
        type: Sequelize.DATE,
        defaultValue: Sequelize.fn('NOW'),
      },
      updated_at: {
        type: Sequelize.DATE,
        defaultValue: Sequelize.fn('NOW'),
      },
    });

    await queryInterface.addConstraint('user_category_allocation_templates', {
      fields: ['user_id', 'category_id'],
      type: 'unique',
      name: 'unique_user_category_template',
    });

    // 3. Crear UserCategoryAllocationInstance
    await queryInterface.createTable('income_category_allocation', {
      id: {
        type: Sequelize.UUID,
        primaryKey: true,
        defaultValue: Sequelize.literal('gen_random_uuid()'),
      },
      income_id: {
        type: Sequelize.UUID,
        allowNull: false,
        references: {
          model: 'incomes',
          key: 'id',
        },
        onDelete: 'CASCADE',
      },
      category_id: {
        type: Sequelize.UUID,
        allowNull: false,
        references: {
          model: 'categories',
          key: 'id',
        },
        onDelete: 'CASCADE',
      },
      percentage: {
        type: Sequelize.DECIMAL(5, 2),
        allowNull: false,
      },
      amount_allocated: {
        type: Sequelize.DECIMAL(12, 2),
        allowNull: false,
      },
      created_at: {
        type: Sequelize.DATE,
        defaultValue: Sequelize.fn('NOW'),
      },
      updated_at: {
        type: Sequelize.DATE,
        defaultValue: Sequelize.fn('NOW'),
      },
    });

    await queryInterface.addConstraint('income_category_allocation', {
      fields: ['income_id', 'category_id'],
      type: 'unique',
      name: 'unique_income_category_instance',
    });

    // 4. Agregar columna category_id a expenses (si vas a reemplazar ENUM)
    await queryInterface.addColumn('expenses', 'category_id', {
      type: Sequelize.UUID,
      allowNull: true, // temporalmente true para migración
      references: {
        model: 'categories',
        key: 'id',
      },
      onDelete: 'SET NULL',
    });
  },

  down: async (queryInterface, Sequelize) => {
    await queryInterface.removeColumn('expenses', 'category_id');
    await queryInterface.dropTable('user_category_allocation_instances');
    await queryInterface.dropTable('user_category_allocation_templates');
    await queryInterface.dropTable('categories');
  },
};
