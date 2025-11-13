'use strict';
const { v4: uuidv4 } = require('uuid');

module.exports = {
  up: async (queryInterface, Sequelize) => {
    // Step 1: Find or create a GENERIC category and sub-category to use as a default.
    // This makes the migration self-sufficient and not dependent on seeders.
    const [genericCategoryResult] = await queryInterface.sequelize.query(
      `SELECT id FROM categories WHERE name = 'GENERIC' LIMIT 1;`
    );

    let categoryId;
    if (genericCategoryResult.length > 0) {
      categoryId = genericCategoryResult[0].id;
    } else {
      const newCategoryId = uuidv4();
      await queryInterface.bulkInsert('categories', [{
        id: newCategoryId,
        name: 'GENERIC',
        created_at: new Date(),
        updated_at: new Date(),
      }]);
      categoryId = newCategoryId;
    }

    const [genericSubCategoryResult] = await queryInterface.sequelize.query(
      `SELECT id FROM sub_categories WHERE name = 'GENERIC' AND category_id = '${categoryId}' LIMIT 1;`
    );

    let subCategoryId;
    if (genericSubCategoryResult.length > 0) {
      subCategoryId = genericSubCategoryResult[0].id;
    } else {
      const newSubCategoryId = uuidv4();
      await queryInterface.bulkInsert('sub_categories', [{
        id: newSubCategoryId,
        name: 'GENERIC',
        category_id: categoryId,
        created_at: new Date(),
        updated_at: new Date(),
      }]);
      subCategoryId = newSubCategoryId;
    }

    // Step 2: Update all expenses that have a NULL sub_category_id.
    await queryInterface.sequelize.query(`
      UPDATE expenses
      SET sub_category_id = '${subCategoryId}'
      WHERE sub_category_id IS NULL
    `);

    // Step 3: Now that the data is clean, apply the NOT NULL constraint.
    await queryInterface.changeColumn('expenses', 'sub_category_id', {
      type: Sequelize.UUID,
      allowNull: false,
      references: {
        model: 'sub_categories',
        key: 'id',
      },
      onDelete: 'SET NULL',
    });
  },

  down: async (queryInterface, Sequelize) => {
    // The down migration simply makes the column nullable again.
    await queryInterface.changeColumn('expenses', 'sub_category_id', {
      type: Sequelize.UUID,
      allowNull: true,
      references: {
        model: 'sub_categories',
        key: 'id',
      },
      onDelete: 'SET NULL',
    });
  }
};
