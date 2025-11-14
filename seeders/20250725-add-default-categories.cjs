'use strict';
const { v4: uuidv4 } = require('uuid');

const PARENT_CHILD = {
  HOUSEHOLD: ['BILLS', 'RENT', 'MORTGAGE', 'SUPERMARKET', 'SUPER_MARKET', 'FOOD', 'UTILITIES', 'HOME_MAINTENANCE', 'HOME_INSURANCE', 'HOUSE'],
  FOOD_AND_DRINKS: ['GROCERIES', 'DINING_OUT', 'COFFEE', 'DELIVERY', 'SNACKS', 'EATING_OUT'],
  TRANSPORTATION: ['CAR', 'FUEL', 'PUBLIC_TRANSPORT', 'TAXI_RIDES', 'CAR_MAINTENANCE', 'CAR_INSURANCE', 'TOLLS_PARKING', 'TRANSPORT'],
  COMMUNICATION_SUBSCRIPTIONS: ['COMMUNICATION', 'MOBILE_PHONE', 'INTERNET', 'STREAMING_SERVICES', 'SUBSCRIPTION', 'OTHER_SUBSCRIPTIONS'],
  FINANCIAL: ['SAVINGS', 'INVESTMENTS', 'LOANS_DEBTS', 'CREDIT_PAYMENTS', 'TAXES', 'INSURANCE'],
  HEALTH_WELLNESS: ['DOCTOR', 'MEDICATION', 'HEALTH_INSURANCE', 'GYM_FITNESS', 'PETS', 'HEALTH', 'SPORTS'],
  LIFESTYLE: ['CLOTHES', 'ENTERTAINMENT', 'SOCIAL_OUTINGS', 'GIFTS', 'TRAVEL', 'HANG_OUT'],
  EDUCATION_DEVELOPMENT: ['COURSES', 'BOOKS', 'ACADEMIC_MATERIALS', 'EDUCATIONAL_SOFTWARE'],
  OTHERS: ['DONATIONS', 'UNEXPECTED_EXPENSES', 'MISC', 'MONTHS_WITHOUT_INTEREST', 'FIXED_EXPENSE'],
};

// Helper function to find or create a record
async function findOrCreate(queryInterface, table, where, defaults) {
  const [results] = await queryInterface.sequelize.query(`SELECT id FROM ${table} WHERE ${Object.keys(where).map(key => `${key} = '${where[key]}'`).join(' AND ')} LIMIT 1;`);
  if (results.length > 0) {
    return results[0];
  }
  const id = defaults.id || uuidv4();
  await queryInterface.bulkInsert(table, [{ ...defaults, ...where, id }]);
  return { id };
}

module.exports = {
  async up(queryInterface, Sequelize) {
    // 1. Find or create GENERIC category and sub-category
    const genericCategory = await findOrCreate(queryInterface, 'categories', { name: 'GENERIC' }, { created_at: new Date(), updated_at: new Date() });
    const genericSubcat = await findOrCreate(queryInterface, 'sub_categories', { name: 'GENERIC', category_id: genericCategory.id }, { created_at: new Date(), updated_at: new Date() });

    // 2. Loop through and find or create other categories and sub-categories
    for (const [parent, children] of Object.entries(PARENT_CHILD)) {
      const category = await findOrCreate(queryInterface, 'categories', { name: parent }, { created_at: new Date(), updated_at: new Date() });

      for (const child of children) {
        const subcat = await findOrCreate(queryInterface, 'sub_categories', { name: child, category_id: category.id }, { created_at: new Date(), updated_at: new Date() });

        // Update existing expenses based on the old category string.
        // This will overwrite the 'GENERIC' ID set by the migration.
        await queryInterface.sequelize.query(`
          UPDATE expenses
          SET sub_category_id = '${subcat.id}'
          WHERE category = '${child}'
        `);
      }
    }

    // 3. Assign GENERIC sub_category_id to any expenses that couldn't be mapped
    // This query will now only affect expenses where the 'category' string didn't match anything.
    await queryInterface.sequelize.query(`
      UPDATE expenses
      SET sub_category_id = '${genericSubcat.id}'
      WHERE sub_category_id IS NULL
    `);
  },

  async down(queryInterface) {
    // The down migration can remain as is, as it's not selective.
    await queryInterface.bulkDelete('sub_categories', null, {});
    await queryInterface.bulkDelete('categories', null, {});
  },
};
