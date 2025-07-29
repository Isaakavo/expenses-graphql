'use strict';
const { v4: uuidv4 } = require('uuid');

const PARENT_CHILD = {
  LIFESTYLE: [
    'CLOTHES',
    'ENTERTAINMENT',
    'EATING_OUT',
    'SPORTS',
    'HANG_OUT',
    'GIFTS',
  ],
  HOUSEHOLD: [
    'FOOD',
    'SUPER_MARKET',
    'HOUSE',
    'INSURANCE',
    'FIXED_EXPENSE',
    'BILLS',
  ],
  TRANSPORT: ['CAR', 'TRANSPORT'],
  COMMUNICATION: ['COMMUNICATION', 'SUBSCRIPTION'],
  FINANCIAL: ['SAVINGS', 'MONTHS_WITHOUT_INTEREST'],
  HEALTH: ['HEALTH', 'PETS'],
};

module.exports = {
  async up(queryInterface, Sequelize) {
    const categoriesMap = {};
    for (const [parent, children] of Object.entries(PARENT_CHILD)) {
      const [category] = await queryInterface.bulkInsert(
        'categories',
        [
          {
            id: uuidv4(),
            name: parent,
            created_at: new Date(),
            updated_at: new Date(),
          },
        ],
        { returning: true }
      );

      categoriesMap[parent] = category.id;

      for (const child of children) {
        const [subcat] = await queryInterface.bulkInsert(
          'sub_categories',
          [
            {
              id: uuidv4(),
              name: child,
              category_id: category.id,
              created_at: new Date(),
              updated_at: new Date(),
            },
          ],
          { returning: true }
        );

        // update existing expenses
        await queryInterface.sequelize.query(`
          UPDATE expenses
          SET subcategory_id = '${subcat.id}'
          WHERE category = '${child}'
        `);
      }
    }
  },

  async down(queryInterface) {
    await queryInterface.bulkDelete('subcategories', null, {});
    await queryInterface.bulkDelete('categories', null, {});
  },
};
