'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    // Obtener todos los usuarios
    const [users] = await queryInterface.sequelize.query(`
      SELECT DISTINCT user_id FROM expenses
    `);

    // Obtener las categorías default (sin user_id)
    const [defaultCategories] = await queryInterface.sequelize.query(`
      SELECT id, name FROM categories WHERE user_id IS NULL
    `);

    const groups = {
      NEEDS: [
        'HOUSE',
        'BILLS',
        'FOOD',
        'TRANSPORT',
        'INSURANCE',
        'SUPER_MARKET',
      ],
      WANTS: ['ENTERTAINMENT', 'EATING_OUT', 'CLOTHES', 'SUBSCRIPTION'],
      SAVINGS: ['SAVINGS'],
    };

    const now = new Date();
    const allAllocations = [];

    for (const user of users) {
      const userId = user.user_id;

      const userCategoryMap = {};

      // Clonar categorías
      for (const cat of defaultCategories) {
        userCategoryMap[cat.name] = cat.id;
      }

      // Generar asignaciones
      for (const [groupName, catNames] of Object.entries(groups)) {
        const totalPercent =
          groupName === 'NEEDS' ? 50 : groupName === 'WANTS' ? 30 : 20;

        const validCategories = catNames.filter(
          (name) => userCategoryMap[name]
        );
        const perCategoryPercent =
          validCategories.length > 0
            ? totalPercent / validCategories.length
            : 0;

        for (const name of validCategories) {
          allAllocations.push({
            user_id: userId,
            category_id: userCategoryMap[name],
            percentage: perCategoryPercent,
            created_at: now,
            updated_at: now,
          });
        }
      }
    }

    if (allAllocations.length > 0) {
      await queryInterface.bulkInsert(
        'user_category_allocation_templates',
        allAllocations
      );
    }
  },

  down: async (queryInterface, Sequelize) => {
    await queryInterface.bulkDelete(
      'user_category_allocation_templates',
      null,
      {}
    );
    await queryInterface.bulkDelete('categories', {
      user_id: { [Sequelize.Op.ne]: null },
    });
  },
};
