'use-strict';

const { v4: uuidv4 } = require('uuid');

function getFortnightRange(date) {
  // Cutoff date: April 1st, 2025. Month is 0-indexed, so 3 is April.
  const cutoffDate = new Date(Date.UTC(2025, 3, 1));

  if (date >= cutoffDate) {
    // New logic: 14-day period (start date + 13 days)
    const startDate = new Date(date);
    startDate.setUTCHours(0, 0, 0, 0);

    const endDate = new Date(startDate);
    endDate.setUTCDate(startDate.getUTCDate() + 13);
    endDate.setUTCHours(23, 59, 59, 999);
    return { start: startDate, end: endDate };
  } else {
    // Old logic: 1-15 and 16-EOM
    const year = date.getUTCFullYear();
    const month = date.getUTCMonth();
    const day = date.getUTCDate();
    if (day <= 15) {
      return {
        start: new Date(Date.UTC(year, month, 1)),
        end: new Date(Date.UTC(year, month, 15, 23, 59, 59, 999)),
      };
    } else {
      const lastDay = new Date(Date.UTC(year, month + 1, 0)).getDate();
      return {
        start: new Date(Date.UTC(year, month, 16)),
        end: new Date(Date.UTC(year, month, lastDay, 23, 59, 59, 999)),
      };
    }
  }
}

module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.createTable('periods', {
      id: { type: Sequelize.UUID, primaryKey: true },
      user_id: { type: Sequelize.UUID, allowNull: false },
      type: {
        type: Sequelize.ENUM('WEEKLY', 'FORTNIGHTLY', 'MONTHLY'),
        allowNull: false,
      },
      start_date: { type: Sequelize.DATE, allowNull: false },
      end_date: { type: Sequelize.DATE, allowNull: false },
      created_at: Sequelize.DATE,
      updated_at: Sequelize.DATE,
    });

    await queryInterface.addConstraint('periods', {
      fields: ['user_id', 'type', 'start_date'],
      type: 'unique',
      name: 'unique_period_per_user_type_startdate',
    });

    await queryInterface.addColumn('expenses', 'period_id', {
      type: Sequelize.UUID,
      allowNull: true,
      references: { model: 'periods', key: 'id' },
      onDelete: 'CASCADE',
    });

    await queryInterface.addColumn('incomes', 'period_id', {
      type: Sequelize.UUID,
      allowNull: true,
      references: { model: 'periods', key: 'id' },
      onDelete: 'CASCADE',
    });

    const [incomes] = await queryInterface.sequelize.query(
      'SELECT id, user_id, payment_date FROM incomes'
    );
    const [expenses] = await queryInterface.sequelize.query(
      'SELECT id, user_id, pay_before FROM expenses'
    );

    const periodMap = {};

    for (const list of [incomes, expenses]) {
      for (const row of list) {
        const userId = row.user_id;
        const date = new Date(row.payment_date || row.pay_before);
        const { start, end } = getFortnightRange(date);
        const key = `${userId}_${start.toISOString()}_${end.toISOString()}`;
        if (!periodMap[key]) {
          const periodId = uuidv4();
          periodMap[key] = periodId;
          await queryInterface.bulkInsert('periods', [
            {
              id: periodId,
              user_id: userId,
              type: 'FORTNIGHTLY',
              start_date: start,
              end_date: end,
              created_at: new Date(),
              updated_at: new Date(),
            },
          ]);
        }
      }
    }

    for (const income of incomes) {
      const date = new Date(income.payment_date);
      const { start, end } = getFortnightRange(date);
      const key = `${
        income.user_id
      }_${start.toISOString()}_${end.toISOString()}`;
      const periodId = periodMap[key];
      await queryInterface.sequelize.query(`
        UPDATE incomes SET period_id = '${periodId}' WHERE id = '${income.id}'
      `);
    }

    for (const expense of expenses) {
      const date = new Date(expense.pay_before);
      const { start, end } = getFortnightRange(date);
      const key = `${
        expense.user_id
      }_${start.toISOString()}_${end.toISOString()}`;
      const periodId = periodMap[key];
      await queryInterface.sequelize.query(`
        UPDATE expenses
        SET period_id = '${periodId}'
        WHERE id = '${expense.id}'
      `);
    }

    await queryInterface.changeColumn('expenses', 'period_id', {
      type: Sequelize.UUID,
      allowNull: false,
      references: { model: 'periods', key: 'id' },
      onDelete: 'CASCADE',
    });

    await queryInterface.changeColumn('incomes', 'period_id', {
      type: Sequelize.UUID,
      allowNull: false,
      references: { model: 'periods', key: 'id' },
      onDelete: 'CASCADE',
    });
  },

  down: async (queryInterface, Sequelize) => {
    await queryInterface.removeColumn('expenses', 'income_id');
    await queryInterface.removeColumn('expenses', 'period_id');
    await queryInterface.removeColumn('incomes', 'period_id');
    await queryInterface.dropTable('periods');
  },
};
