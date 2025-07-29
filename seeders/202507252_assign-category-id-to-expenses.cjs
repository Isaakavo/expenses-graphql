'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    // Obtener categorías actuales con user_id y nombre
    const [categories] = await queryInterface.sequelize.query(`
      SELECT id, name
      FROM categories
    `);

    // Crear un mapa rápido para búsquedas
    const categoryMap = new Map();
    for (const cat of categories) {
      categoryMap.set(`${cat.name}`, cat.id);
    }

    // Obtener todos los expenses con user_id y category
    const [expenses] = await queryInterface.sequelize.query(`
      SELECT id, user_id, category
      FROM expenses
    `);

    // Actualizar cada expense con el category_id correspondiente
    for (const expense of expenses) {
      const key = `${expense.category}`;
      const categoryId = categoryMap.get(key);

      if (categoryId) {
        await queryInterface.sequelize.query(`
          UPDATE expenses
          SET category_id = :categoryId
          WHERE id = :expenseId
        `, {
          replacements: {
            categoryId,
            expenseId: expense.id,
          }
        });
      } else {
        console.warn(`⚠️ No se encontró category_id para expense ${expense.id} con user_id ${expense.user_id} y category ${expense.category}`);
      }
    }
  },

  down: async (queryInterface, Sequelize) => {
    // Revertir: dejar category_id en null
    await queryInterface.sequelize.query(`
      UPDATE expenses
      SET category_id = NULL
    `);
  }
};
