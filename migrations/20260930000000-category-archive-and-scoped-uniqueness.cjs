'use strict';

/**
 * Category management:
 *  - Soft delete (archive) for categories and sub categories via `archived_at`.
 *  - Replace the global UNIQUE(name) constraints (created by `unique: true` in
 *    20250725120000-add-category-settings.cjs, which Postgres names
 *    `<table>_name_key`) with case-insensitive, scope-aware partial unique indexes:
 *      categories:     (lower(name))                        WHERE user_id IS NULL
 *                      (user_id, lower(name))               WHERE user_id IS NOT NULL
 *      sub_categories: (category_id, lower(name))           WHERE user_id IS NULL
 *                      (category_id, user_id, lower(name))  WHERE user_id IS NOT NULL
 *  Cross-scope rules (custom vs global names) are enforced in the service layer.
 *
 * NOTE on `down`: re-adding the global UNIQUE(name) constraints will FAIL if users
 * created names that already exist elsewhere (e.g. two users with a custom
 * "Concerts" sub category, or the same sub category name under two categories).
 * Resolve those duplicates manually before rolling back.
 */
module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.sequelize.transaction(async (transaction) => {
      await queryInterface.addColumn(
        'categories',
        'archived_at',
        { type: Sequelize.DATE, allowNull: true },
        { transaction }
      );
      await queryInterface.addColumn(
        'sub_categories',
        'archived_at',
        { type: Sequelize.DATE, allowNull: true },
        { transaction }
      );

      await queryInterface.sequelize.query(
        'ALTER TABLE categories DROP CONSTRAINT IF EXISTS categories_name_key;',
        { transaction }
      );
      await queryInterface.sequelize.query(
        'ALTER TABLE sub_categories DROP CONSTRAINT IF EXISTS sub_categories_name_key;',
        { transaction }
      );

      await queryInterface.sequelize.query(
        `CREATE UNIQUE INDEX categories_global_name_unique
           ON categories (lower(name)) WHERE user_id IS NULL;`,
        { transaction }
      );
      await queryInterface.sequelize.query(
        `CREATE UNIQUE INDEX categories_user_name_unique
           ON categories (user_id, lower(name)) WHERE user_id IS NOT NULL;`,
        { transaction }
      );
      await queryInterface.sequelize.query(
        `CREATE UNIQUE INDEX sub_categories_global_name_unique
           ON sub_categories (category_id, lower(name)) WHERE user_id IS NULL;`,
        { transaction }
      );
      await queryInterface.sequelize.query(
        `CREATE UNIQUE INDEX sub_categories_user_name_unique
           ON sub_categories (category_id, user_id, lower(name)) WHERE user_id IS NOT NULL;`,
        { transaction }
      );
    });
  },

  down: async (queryInterface) => {
    await queryInterface.sequelize.transaction(async (transaction) => {
      await queryInterface.sequelize.query(
        `DROP INDEX IF EXISTS sub_categories_user_name_unique;
         DROP INDEX IF EXISTS sub_categories_global_name_unique;
         DROP INDEX IF EXISTS categories_user_name_unique;
         DROP INDEX IF EXISTS categories_global_name_unique;`,
        { transaction }
      );

      // Fails if duplicate names were created while this migration was applied (see header).
      await queryInterface.sequelize.query(
        'ALTER TABLE sub_categories ADD CONSTRAINT sub_categories_name_key UNIQUE (name);',
        { transaction }
      );
      await queryInterface.sequelize.query(
        'ALTER TABLE categories ADD CONSTRAINT categories_name_key UNIQUE (name);',
        { transaction }
      );

      await queryInterface.removeColumn('sub_categories', 'archived_at', { transaction });
      await queryInterface.removeColumn('categories', 'archived_at', { transaction });
    });
  },
};
