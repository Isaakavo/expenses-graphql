'use strict';
const { v4: uuidv4 } = require('uuid');

const PARENT_CHILD = {
  HOUSEHOLD: [
    'BILLS',
    'RENT',
    'MORTGAGE',
    'SUPERMARKET',
    'SUPER_MARKET',
    'FOOD',
    'UTILITIES',
    'HOME_MAINTENANCE',
    'HOME_INSURANCE',
    'HOUSE',
  ],
  FOOD_AND_DRINKS: [
    'GROCERIES',
    'DINING_OUT',
    'COFFEE',
    'DELIVERY',
    'SNACKS',
    'EATING_OUT',
  ],
  TRANSPORTATION: [
    'CAR',
    'FUEL',
    'PUBLIC_TRANSPORT',
    'TAXI_RIDES',
    'CAR_MAINTENANCE',
    'CAR_INSURANCE',
    'TOLLS_PARKING',
    'TRANSPORT',
  ],
  COMMUNICATION_SUBSCRIPTIONS: [
    'COMMUNICATION',
    'MOBILE_PHONE',
    'INTERNET',
    'STREAMING_SERVICES',
    'SUBSCRIPTION',
    'OTHER_SUBSCRIPTIONS',
  ],
  FINANCIAL: [
    'SAVINGS',
    'INVESTMENTS',
    'LOANS_DEBTS',
    'CREDIT_PAYMENTS',
    'TAXES',
    'INSURANCE',
  ],
  HEALTH_WELLNESS: [
    'DOCTOR',
    'MEDICATION',
    'HEALTH_INSURANCE',
    'GYM_FITNESS',
    'PETS',
    'HEALTH',
    'SPORTS',
  ],
  LIFESTYLE: [
    'CLOTHES',
    'ENTERTAINMENT',
    'SOCIAL_OUTINGS',
    'GIFTS',
    'TRAVEL',
    'HANG_OUT',
  ],
  EDUCATION_DEVELOPMENT: [
    'COURSES',
    'BOOKS',
    'ACADEMIC_MATERIALS',
    'EDUCATIONAL_SOFTWARE',
  ],
  OTHERS: [
    'DONATIONS',
    'UNEXPECTED_EXPENSES',
    'MISC',
    'MONTHS_WITHOUT_INTEREST',
    'FIXED_EXPENSE',
  ],
};

module.exports = {
  async up(queryInterface, Sequelize) {
    // 1. Crear categoría y subcategoría GENERIC por si hay gastos no mapeados
    const [genericCategory] = await queryInterface.bulkInsert(
      'categories',
      [
        {
          id: uuidv4(),
          name: 'GENERIC',
          created_at: new Date(),
          updated_at: new Date(),
        },
      ],
      { returning: true }
    );
    const [genericSubcat] = await queryInterface.bulkInsert(
      'sub_categories',
      [
        {
          id: uuidv4(),
          name: 'GENERIC',
          category_id: genericCategory.id,
          created_at: new Date(),
          updated_at: new Date(),
        },
      ],
      { returning: true }
    );

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
          SET sub_category_id = '${subcat.id}'
          WHERE category = '${child}'
        `);
      }
    }

    // 2. Asignar sub_category_id GENERIC a todos los gastos que sigan con NULL
    await queryInterface.sequelize.query(`
      UPDATE expenses
      SET sub_category_id = '${genericSubcat.id}'
      WHERE sub_category_id IS NULL
    `);
  },

  async down(queryInterface) {
    await queryInterface.bulkDelete('sub_categories', null, {});
    await queryInterface.bulkDelete('categories', null, {});
  },
};
