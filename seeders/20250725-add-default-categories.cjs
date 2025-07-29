'use strict';

const { v4: uuidv4 } = require('uuid');

const categories = [
  'BILLS',
  'CAR',
  'CLOTHES',
  'COMMUNICATION',
  'EATING_OUT',
  'ENTERTAINMENT',
  'FOOD',
  'GIFTS',
  'HEALTH',
  'HOUSE',
  'INSURANCE',
  'MONTHS_WITHOUT_INTEREST',
  'PETS',
  'SPORTS',
  'TRANSPORT',
  'SUPER_MARKET',
  'HANG_OUT',
  'SAVINGS',
  'SUBSCRIPTION',
  'FIXED_EXPENSE'
];

module.exports = {
  up: async (queryInterface, Sequelize) => {
    const now = new Date();
    const rows = categories.map((name) => ({
      id: uuidv4(),
      name,
      user_id: null, // Cambia si deseas asociarlas a un usuario específico
      created_at: now,
      updated_at: now,
    }));

    await queryInterface.bulkInsert('categories', rows, {
      ignoreDuplicates: true, // Para evitar conflictos si ya existen
    });
  },

  down: async (queryInterface, Sequelize) => {
    await queryInterface.bulkDelete('categories', {
      name: categories,
      user_id: null,
    });
  },
};
