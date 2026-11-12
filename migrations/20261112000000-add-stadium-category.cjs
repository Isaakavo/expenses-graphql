'use strict';

const STADIUM = 'STADIUM';
const NEW_SUB_CATEGORIES = ['BASEBALL', 'HOCKEY', 'NFL', 'SOCCER'];
const MOVED_SUB_CATEGORY = 'SPORTS';
const MOVED_FROM = 'HEALTH_WELLNESS';
const LIFESTYLE = 'LIFESTYLE';
const STADIUM_SHARE = 0.05;

const queryRows = (sequelize, sql, replacements, transaction) =>
  sequelize.query(sql, { replacements, transaction, type: sequelize.QueryTypes.SELECT });

const idOf = async (sequelize, sql, replacements, transaction) =>
  (await queryRows(sequelize, sql, replacements, transaction))[0]?.id;

const findOrCreateCategory = async (sequelize, name, transaction) =>
  (await idOf(sequelize, 'SELECT id FROM categories WHERE name = :name', { name }, transaction)) ??
  idOf(
    sequelize,
    `INSERT INTO categories (id, name, created_at, updated_at)
     VALUES (gen_random_uuid(), :name, NOW(), NOW()) RETURNING id`,
    { name },
    transaction
  );

const placeSubCategory = async (sequelize, name, categoryId, transaction) =>
  (await idOf(
    sequelize,
    `UPDATE sub_categories SET category_id = :categoryId, updated_at = NOW()
     WHERE name = :name RETURNING id`,
    { name, categoryId },
    transaction
  )) ??
  idOf(
    sequelize,
    `INSERT INTO sub_categories (id, name, category_id, created_at, updated_at)
     VALUES (gen_random_uuid(), :name, :categoryId, NOW(), NOW()) RETURNING id`,
    { name, categoryId },
    transaction
  );

const lifestyleStadiumId = (sequelize, transaction) =>
  idOf(
    sequelize,
    `SELECT s.id FROM sub_categories s JOIN categories c ON c.id = s.category_id
     WHERE s.name = :stadium AND c.name = :lifestyle`,
    { stadium: STADIUM, lifestyle: LIFESTYLE },
    transaction
  );

module.exports = {
  up: async (queryInterface) => {
    const { sequelize } = queryInterface;
    await sequelize.transaction(async (transaction) => {
      const stadiumId = await findOrCreateCategory(sequelize, STADIUM, transaction);

      const subCategoryIds = {};
      for (const name of [MOVED_SUB_CATEGORY, ...NEW_SUB_CATEGORIES]) {
        subCategoryIds[name] = await placeSubCategory(sequelize, name, stadiumId, transaction);
      }

      const oldStadiumId = await lifestyleStadiumId(sequelize, transaction);
      if (oldStadiumId) {
        await sequelize.query(
          'UPDATE expenses SET sub_category_id = :baseball WHERE sub_category_id = :oldStadiumId',
          { replacements: { baseball: subCategoryIds.BASEBALL, oldStadiumId }, transaction }
        );
        await sequelize.query('DELETE FROM sub_categories WHERE id = :oldStadiumId', {
          replacements: { oldStadiumId },
          transaction,
        });
      }

      // Users already at 100% would be locked out of editing their settings, so the share comes out of LIFESTYLE
      await sequelize.query(
        `UPDATE category_settings cs
         SET percentage = GREATEST(cs.percentage - :share, 0), updated_at = NOW()
         FROM categories c
         WHERE c.id = cs.category_id AND c.name = :lifestyle
           AND cs.user_id IN (
             SELECT user_id FROM category_settings GROUP BY user_id
             HAVING SUM(percentage) + :share > 1 AND NOT bool_or(category_id = :stadiumId)
           )`,
        { replacements: { share: STADIUM_SHARE, lifestyle: LIFESTYLE, stadiumId }, transaction }
      );
      await sequelize.query(
        `INSERT INTO category_settings (id, user_id, category_id, percentage, created_at, updated_at)
         SELECT gen_random_uuid(), user_id, :stadiumId, :share, NOW(), NOW()
         FROM category_settings GROUP BY user_id
         HAVING NOT bool_or(category_id = :stadiumId)`,
        { replacements: { share: STADIUM_SHARE, stadiumId }, transaction }
      );
    });
  },

  down: async (queryInterface) => {
    const { sequelize } = queryInterface;
    await sequelize.transaction(async (transaction) => {
      const stadiumId = await idOf(sequelize, 'SELECT id FROM categories WHERE name = :name', { name: STADIUM }, transaction);
      if (!stadiumId) return;

      const lifestyleId = await findOrCreateCategory(sequelize, LIFESTYLE, transaction);
      const oldStadiumId =
        (await lifestyleStadiumId(sequelize, transaction)) ??
        (await idOf(
          sequelize,
          `INSERT INTO sub_categories (id, name, category_id, created_at, updated_at)
           VALUES (gen_random_uuid(), :name, :lifestyleId, NOW(), NOW()) RETURNING id`,
          { name: STADIUM, lifestyleId },
          transaction
        ));

      const replacements = { stadiumId, lifestyleId, oldStadiumId, newNames: NEW_SUB_CATEGORIES };
      await sequelize.query(
        `UPDATE expenses SET sub_category_id = :oldStadiumId
         WHERE sub_category_id IN (SELECT id FROM sub_categories WHERE category_id = :stadiumId AND name IN (:newNames))`,
        { replacements, transaction }
      );
      await sequelize.query(
        'DELETE FROM sub_categories WHERE category_id = :stadiumId AND name IN (:newNames)',
        { replacements, transaction }
      );
      await sequelize.query(
        `UPDATE sub_categories SET category_id = (SELECT id FROM categories WHERE name = :movedFrom), updated_at = NOW()
         WHERE name = :moved AND EXISTS (SELECT 1 FROM categories WHERE name = :movedFrom)`,
        { replacements: { moved: MOVED_SUB_CATEGORY, movedFrom: MOVED_FROM }, transaction }
      );

      await sequelize.query(
        `UPDATE category_settings lifestyle
         SET percentage = LEAST(lifestyle.percentage + stadium.percentage, 1), updated_at = NOW()
         FROM category_settings stadium
         WHERE stadium.user_id = lifestyle.user_id AND stadium.category_id = :stadiumId
           AND lifestyle.category_id = :lifestyleId
           AND lifestyle.user_id IN (SELECT user_id FROM category_settings GROUP BY user_id HAVING SUM(percentage) >= 1)`,
        { replacements, transaction }
      );
      await sequelize.query('DELETE FROM category_settings WHERE category_id = :stadiumId', { replacements, transaction });
      await sequelize.query('DELETE FROM income_category_allocation WHERE category_id = :stadiumId', {
        replacements,
        transaction,
      });
      await sequelize.query('DELETE FROM categories WHERE id = :stadiumId', { replacements, transaction });
    });
  },
};
