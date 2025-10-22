'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.sequelize.query(`
      ALTER TABLE expenses
      ALTER COLUMN category TYPE VARCHAR
      USING category::VARCHAR;
    `);

    await queryInterface.sequelize.query(`
      DROP TYPE IF EXISTS enum_expenses_category;
    `);

    // 1. Crear tabla categories si no existe
    await queryInterface.createTable('categories', {
      id: {
        type: Sequelize.UUID,
        primaryKey: true,
      },
      user_id: {
        type: Sequelize.UUID,
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

    // 2. Crear sub_categories
    await queryInterface.createTable('sub_categories', {
      id: {
        type: Sequelize.UUID,
        primaryKey: true,
      },
      name: {
        type: Sequelize.STRING,
        unique: true,
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
      user_id: {
        type: Sequelize.UUID,
        allowNull: true,
      },
      created_at: Sequelize.DATE,
      updated_at: Sequelize.DATE,
    });

    // 3. Plantilla de asignación de categorías de usuario
    await queryInterface.createTable('category_settings', {
      id: {
        type: Sequelize.UUID,
        primaryKey: true,
      },
      user_id: {
        type: Sequelize.UUID,
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

    await queryInterface.addConstraint('category_settings', {
      fields: ['user_id', 'category_id'],
      type: 'unique',
      name: 'unique_category_settings',
    });

    // 4. Instancia de asignación por ingreso
    await queryInterface.createTable('income_category_allocation', {
      id: {
        type: Sequelize.UUID,
        primaryKey: true,
      },
      user_id: {
        type: Sequelize.UUID,
        allowNull: false,
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

    // 5. Agregar sub_category_id a expenses (allowNull: true)
    await queryInterface.addColumn('expenses', 'sub_category_id', {
      type: Sequelize.UUID,
      allowNull: true, // Temporalmente true para la migración
      references: {
        model: 'sub_categories',
        key: 'id',
      },
      onDelete: 'SET NULL',
    });

    await queryInterface.changeColumn('expenses', 'category', {
      type: Sequelize.STRING,
      allowNull: true,
    });
  },

  down: async (queryInterface) => {
    await queryInterface.removeColumn('expenses', 'sub_category_id');
    await queryInterface.dropTable('income_category_allocation');
    await queryInterface.dropTable('category_settings');
    await queryInterface.dropTable('sub_categories');
    await queryInterface.dropTable('categories');
  },
};
