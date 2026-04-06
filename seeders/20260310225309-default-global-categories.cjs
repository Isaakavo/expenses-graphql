/* eslint-env node */
/* eslint-disable no-console */
'use strict';

// eslint-disable-next-line @typescript-eslint/no-var-requires,no-undef
const { v4: uuidv4 } = require('uuid');

/** @type {import('sequelize-cli').Migration} */
// eslint-disable-next-line no-undef
module.exports = {
  async up(queryInterface) {
    const productionCategories = [
      'HOUSEHOLD',
      'COMMUNICATION_SUBSCRIPTIONS',
      'HEALTH_WELLNESS',
      'LIFESTYLE',
      'FOOD_AND_DRINKS',
      'EDUCATION_DEVELOPMENT',
      'FINANCIAL',
      'OTHERS'
    ];

    for (const catName of productionCategories) {
      // 1. Verificamos si la Categoría ya existe
      const [existingCats] = await queryInterface.sequelize.query(
        `SELECT id FROM categories WHERE name = '${catName}' LIMIT 1;`
      );

      let categoryId;

      if (existingCats.length === 0) {
        categoryId = uuidv4();
        await queryInterface.bulkInsert('categories', [{
          id: categoryId,
          user_id: null,
          name: catName,
          created_at: new Date(),
          updated_at: new Date()
        }]);
        console.log(`✅ Categoría base creada: ${catName}`);
      } else {
        categoryId = existingCats[0].id;
        console.log(`⚡ Categoría ya existía: ${catName}`);
      }

      // 2. Creamos un nombre ÚNICO para la subcategoría para que PostgreSQL no se enoje
      const subName = catName === 'OTHERS' ? 'GENERAL' : `GENERAL ${catName}`;

      const [existingSubs] = await queryInterface.sequelize.query(
        `SELECT id FROM sub_categories WHERE name = '${subName}' LIMIT 1;`
      );

      if (existingSubs.length === 0) {
        await queryInterface.bulkInsert('sub_categories', [{
          id: uuidv4(),
          category_id: categoryId,
          name: subName,
          created_at: new Date(),
          updated_at: new Date()
        }]);
        console.log(`   ↳ ✅ Subcategoría creada: ${subName}`);
      } else {
        console.log(`   ↳ ⚡ Subcategoría ya existía: ${subName}`);
      }
    }
  },

  async down() {
    console.log('Reversión manual requerida para no afectar datos de usuarios.');
  }
};