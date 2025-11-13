'use strict';

const { v4: uuidv4 } = require('uuid');

module.exports = {
  up: async (queryInterface, Sequelize) => {
    // Step 1: Create default category settings for all users
    const [users] = await queryInterface.sequelize.query(
      'SELECT user_id AS id FROM expenses WHERE user_id IS NOT NULL UNION SELECT user_id AS id FROM incomes WHERE user_id IS NOT NULL'
    );

    const defaultCategorySettings = [
      { name: 'HOUSEHOLD', percentage: 0.50 },
      { name: 'FINANCIAL', percentage: 0.10 },
      { name: 'LIFESTYLE', percentage: 0.10 },
      { name: 'FOOD_AND_DRINKS', percentage: 0.20 },
      { name: 'COMMUNICATION_SUBSCRIPTIONS', percentage: 0.10 },
    ];

    const categoryNames = defaultCategorySettings.map(s => s.name);
    const [categories] = await queryInterface.sequelize.query(
      `SELECT id, name FROM categories WHERE name IN (${categoryNames.map(name => `'${name}'`).join(',')})`
    );

    const categoryMap = categories.reduce((acc, category) => {
      acc[category.name] = category.id;
      return acc;
    }, {});

    const settingsToCreate = [];
    for (const user of users) {
      for (const setting of defaultCategorySettings) {
        const categoryId = categoryMap[setting.name];
        if (categoryId) {
          settingsToCreate.push({
            id: uuidv4(),
            user_id: user.id,
            category_id: categoryId,
            percentage: setting.percentage,
            created_at: new Date(),
            updated_at: new Date(),
          });
        }
      }
    }

    if (settingsToCreate.length > 0) {
      await queryInterface.bulkInsert('category_settings', settingsToCreate, {
        ignoreDuplicates: true,
      });
    }

    // Step 2: Create income_category_allocations for relevant incomes
    const [incomes] = await queryInterface.sequelize.query(
      'SELECT id, user_id, total, payment_date FROM incomes WHERE payment_date >= \'2025-04-04\''
    );

    const [allSettings] = await queryInterface.sequelize.query(
      'SELECT user_id, category_id, percentage FROM category_settings'
    );

    const settingsByUser = allSettings.reduce((acc, setting) => {
      if (!acc[setting.user_id]) {
        acc[setting.user_id] = [];
      }
      acc[setting.user_id].push(setting);
      return acc;
    }, {});

    const allocationsToCreate = [];
    for (const income of incomes) {
      const userSettings = settingsByUser[income.user_id];
      if (userSettings) {
        for (const setting of userSettings) {
          const amountAllocated = income.total * setting.percentage;
          allocationsToCreate.push({
            id: uuidv4(),
            user_id: income.user_id,
            income_id: income.id,
            category_id: setting.category_id,
            percentage: setting.percentage,
            amount_allocated: amountAllocated.toFixed(2),
            created_at: new Date(),
            updated_at: new Date(),
          });
        }
      }
    }

    if (allocationsToCreate.length > 0) {
      await queryInterface.bulkInsert('income_category_allocation', allocationsToCreate, {
        ignoreDuplicates: true,
      });
    }
  },

  down: async (queryInterface, Sequelize) => {
    await queryInterface.bulkDelete('income_category_allocation', null, {});
    await queryInterface.bulkDelete('category_settings', null, {});
  }
};
