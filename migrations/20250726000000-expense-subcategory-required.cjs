'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    // Verifica que no haya NULLs antes de aplicar el constraint
    const [results] = await queryInterface.sequelize.query(`
      SELECT COUNT(*) FROM expenses WHERE sub_category_id IS NULL
    `);
    const count = parseInt(results[0].count, 10);
    if (count > 0) {
      throw new Error(
        `No puedes hacer sub_category_id NOT NULL: aún hay ${count} gastos sin sub_category_id`
      );
    }

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
