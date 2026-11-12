'use strict';

const STADIUM = 'STADIUM';
const NEW_SUB_CATEGORIES = ['BASEBALL', 'HOCKEY', 'NFL', 'SOCCER'];
const LIFESTYLE = 'LIFESTYLE';
const CONCERTS = 'CONCERTS';
const ENTERTAINMENT = 'ENTERTAINMENT';
const SPORTS = 'SPORTS';
const HEALTH_WELLNESS = 'HEALTH_WELLNESS';
const RETIRED_INTO_BASEBALL = [
  { name: STADIUM, category: LIFESTYLE },
  { name: SPORTS, category: HEALTH_WELLNESS },
];
const STADIUM_SHARE = 0.05;
const EXPECTED_PARENTS = {
  ...Object.fromEntries(NEW_SUB_CATEGORIES.map((name) => [name, STADIUM])),
  [CONCERTS]: LIFESTYLE,
  [STADIUM]: LIFESTYLE,
  [SPORTS]: HEALTH_WELLNESS,
};

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

const subCategoryIdIn = (sequelize, name, category, transaction) =>
  idOf(
    sequelize,
    `SELECT s.id FROM sub_categories s JOIN categories c ON c.id = s.category_id
     WHERE s.name = :name AND c.name = :category`,
    { name, category },
    transaction
  );

const findOrCreateSubCategoryIn = async (sequelize, name, category, transaction) =>
  (await subCategoryIdIn(sequelize, name, category, transaction)) ??
  placeSubCategory(sequelize, name, await findOrCreateCategory(sequelize, category, transaction), transaction);

const assertExpectedParents = async (sequelize, transaction) => {
  const found = await queryRows(
    sequelize,
    `SELECT s.name, c.name AS parent FROM sub_categories s JOIN categories c ON c.id = s.category_id
     WHERE s.name IN (:names)`,
    { names: Object.keys(EXPECTED_PARENTS) },
    transaction
  );
  const misplaced = found.filter(({ name, parent }) => parent !== EXPECTED_PARENTS[name]);
  if (misplaced.length > 0) {
    throw new Error(`Unexpected sub-categories: ${misplaced.map(({ name, parent }) => `${parent} > ${name}`).join(', ')}`);
  }
};

module.exports = {
  up: async (queryInterface) => {
    const { sequelize } = queryInterface;
    await sequelize.transaction(async (transaction) => {
      await assertExpectedParents(sequelize, transaction);
      const stadiumId = await findOrCreateCategory(sequelize, STADIUM, transaction);

      const subCategoryIds = {};
      for (const name of NEW_SUB_CATEGORIES) {
        subCategoryIds[name] = await placeSubCategory(sequelize, name, stadiumId, transaction);
      }

      for (const { name, category } of RETIRED_INTO_BASEBALL) {
        const retiredId = await subCategoryIdIn(sequelize, name, category, transaction);
        if (!retiredId) continue;
        await sequelize.query(
          'UPDATE expenses SET sub_category_id = :baseball WHERE sub_category_id = :retiredId',
          { replacements: { baseball: subCategoryIds.BASEBALL, retiredId }, transaction }
        );
        await sequelize.query('DELETE FROM sub_categories WHERE id = :retiredId', {
          replacements: { retiredId },
          transaction,
        });
      }

      const lifestyleId = await findOrCreateCategory(sequelize, LIFESTYLE, transaction);
      await placeSubCategory(sequelize, CONCERTS, lifestyleId, transaction);

      // A total above 100% locks the user out of editing settings, so the share comes out of LIFESTYLE and shrinks if that is not enough
      await sequelize.query(
        `WITH totals AS (
           SELECT user_id, SUM(percentage) AS total,
             COALESCE(SUM(percentage) FILTER (WHERE category_id = :lifestyleId), 0) AS lifestyle
           FROM category_settings GROUP BY user_id
           HAVING NOT bool_or(category_id = :stadiumId)
         ),
         plan AS (
           SELECT user_id, total,
             CASE WHEN total > 1 THEN 0 ELSE LEAST(lifestyle, GREATEST(total + :share - 1, 0)) END AS cut
           FROM totals
         ),
         cut_lifestyle AS (
           UPDATE category_settings cs SET percentage = cs.percentage - plan.cut, updated_at = NOW()
           FROM plan
           WHERE cs.user_id = plan.user_id AND cs.category_id = :lifestyleId AND plan.cut > 0
         )
         INSERT INTO category_settings (id, user_id, category_id, percentage, created_at, updated_at)
         SELECT gen_random_uuid(), user_id, :stadiumId, GREATEST(LEAST(:share, 1 - total + cut), 0), NOW(), NOW()
         FROM plan`,
        { replacements: { share: STADIUM_SHARE, lifestyleId, stadiumId }, transaction }
      );
    });
  },

  down: async (queryInterface) => {
    const { sequelize } = queryInterface;
    await sequelize.transaction(async (transaction) => {
      const stadiumId = await idOf(sequelize, 'SELECT id FROM categories WHERE name = :name', { name: STADIUM }, transaction);
      if (!stadiumId) return;

      const lifestyleId = await findOrCreateCategory(sequelize, LIFESTYLE, transaction);
      const oldStadiumId = await findOrCreateSubCategoryIn(sequelize, STADIUM, LIFESTYLE, transaction);
      await findOrCreateSubCategoryIn(sequelize, SPORTS, HEALTH_WELLNESS, transaction);

      const concertsId = await subCategoryIdIn(sequelize, CONCERTS, LIFESTYLE, transaction);
      const entertainmentId = await subCategoryIdIn(sequelize, ENTERTAINMENT, LIFESTYLE, transaction);
      if (concertsId && entertainmentId) {
        await sequelize.query('UPDATE expenses SET sub_category_id = :entertainmentId WHERE sub_category_id = :concertsId', {
          replacements: { entertainmentId, concertsId },
          transaction,
        });
        await sequelize.query('DELETE FROM sub_categories WHERE id = :concertsId', { replacements: { concertsId }, transaction });
      }

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
        `UPDATE category_settings lifestyle
         SET percentage = lifestyle.percentage + stadium.percentage, updated_at = NOW()
         FROM category_settings stadium
         WHERE stadium.user_id = lifestyle.user_id AND stadium.category_id = :stadiumId
           AND lifestyle.category_id = :lifestyleId`,
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
