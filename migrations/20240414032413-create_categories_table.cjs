'use strict';

const createDate = () => {
  const date = new Date();

  const year = date.getUTCFullYear();
  const month = ('0' + (date.getUTCMonth() + 1)).slice(-2); // Agregar ceros a la izquierda si es necesario
  const day = ('0' + date.getUTCDate()).slice(-2);
  const hours = ('0' + date.getUTCHours()).slice(-2);
  const minutes = ('0' + date.getUTCMinutes()).slice(-2);
  const seconds = ('0' + date.getUTCSeconds()).slice(-2);
  const milliseconds = ('00' + date.getUTCMilliseconds()).slice(-3);
  return `${year}-${month}-${day} ${hours}:${minutes}:${seconds}.${milliseconds} EST`;
};

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('categories', {
      id: {
        type: Sequelize.INTEGER,
        primaryKey: true,
        autoIncrement: true,
      },
      name: {
        type: Sequelize.STRING,
        allowNull: false,
      },
      ['created_at']: {
        type: Sequelize.DATE,
        allowNull: false,
      },
      ['updated_at']: {
        type: Sequelize.DATE,
        allowNull: false,
      },
    });

    const categories = await queryInterface.sequelize.query(`
      SELECT DISTINCT category FROM expenses;
    `);

    const categoriesData = categories[0].map((category) => ({
      name: category.category.toLowerCase(),
      ['updated_at']: createDate(),
      ['created_at']: createDate(),
    }));

    await queryInterface.bulkInsert('categories', categoriesData);

    await queryInterface.addColumn('expenses', 'category_id', {
      type: Sequelize.INTEGER,
      allowNull: true,
      references: {
        model: 'categories',
        key: 'id',
      },
      onUpdate: 'CASCADE',
      onDelete: 'SET NULL',
    });

    await queryInterface.sequelize.query(
      `
      UPDATE expenses
      SET category_id = (
        SELECT id FROM categories WHERE name = LOWER(CAST(expenses.category AS TEXT)) LIMIT 1
      );
    `
    );

    await queryInterface.changeColumn('expenses', 'category_id', {
      type: Sequelize.INTEGER,
      allowNull: false,
      references: {
        model: 'categories',
        key: 'id',
      },
      onUpdate: 'CASCADE',
      onDelete: 'SET NULL',
    });

    await queryInterface.removeColumn('expenses', 'category');
  },

  async down(queryInterface, Sequelize) {
    /**
     * Add reverting commands here.
     *
     * Example:
     * await queryInterface.dropTable('users');
     */

    const categories = await queryInterface.sequelize.query(`
      SELECT DISTINCT name FROM category;
    `);

    const catMap = {};
    categories[0].forEach((cat) => (catMap[cat.name] = cat.name.toUpperCase()));

    await queryInterface.addColumn('expenses', 'category', {
      type: Sequelize.ENUM(...Object.values(catMap)),
      allowNull: true,
    });

    await queryInterface.sequelize.query(
      `
      UPDATE expenses
      SET category = (
        SELECT name::enum_expenses_category FROM category WHERE name = LOWER(CAST(expenses.category AS TEXT)) LIMIT 1
      );
    `
    );

    await queryInterface.changeColumn('expenses', 'category', {
      type: Sequelize.ENUM(...Object.values(catMap)),
      allowNull: true,
    });

    await queryInterface.removeColumn('expenses', 'category_id');

    await queryInterface.dropTable('category');
  },
};
