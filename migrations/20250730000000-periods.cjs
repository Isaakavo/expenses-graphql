'use-strict';

const { v4: uuidv4 } = require('uuid');

function getFortnightRange(date) {
  // For dates before April 1st, 2025, use the old logic (1-15 and 16-EOM).
  const cutoffDate = new Date(Date.UTC(2025, 3, 1));

  if (date < cutoffDate) {
    const year = date.getUTCFullYear();
    const month = date.getUTCMonth();
    const day = date.getUTCDate();
    if (day <= 15) {
      return {
        start: new Date(Date.UTC(year, month, 1)),
        end: new Date(Date.UTC(year, month, 15, 23, 59, 59, 999)),
      };
    } else {
      const lastDay = new Date(Date.UTC(year, month + 1, 0)).getUTCDate();
      return {
        start: new Date(Date.UTC(year, month, 16)),
        end: new Date(Date.UTC(year, month, lastDay, 23, 59, 59, 999)),
      };
    }
  } else {
    // For dates on or after April 1st, 2025, use the new bi-weekly logic.
    // Periods start every other Friday, anchored to April 4th, 2025.
    const year = date.getUTCFullYear();
    const month = date.getUTCMonth();
    const day = date.getUTCDate();

    // Group dates by 1-15 and 16-EOM to map to the correct new period.
    let mappingDate;
    if (day <= 15) {
      mappingDate = new Date(Date.UTC(year, month, 1));
    } else {
      mappingDate = new Date(Date.UTC(year, month, 16));
    }

    const periodCycleAnchor = new Date(Date.UTC(2025, 3, 4)); // Anchor: Friday, April 4th, 2025

    const diffInMs = mappingDate.getTime() - periodCycleAnchor.getTime();
    const msIn14Days = 1000 * 60 * 60 * 24 * 14;
    
    const numCycles = Math.floor(diffInMs / msIn14Days);

    let startDate = new Date(periodCycleAnchor);
    startDate.setUTCDate(startDate.getUTCDate() + numCycles * 14);

    if (startDate.getTime() < mappingDate.getTime()) {
      startDate.setUTCDate(startDate.getUTCDate() + 14);
    }

    const endDate = new Date(startDate);
    endDate.setUTCDate(startDate.getUTCDate() + 13);
    endDate.setUTCHours(23, 59, 59, 999);

    return { start: startDate, end: endDate };
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
    const allItems = [
      ...incomes.map(i => ({ ...i, date: i.payment_date })),
      ...expenses.map(e => ({ ...e, date: e.pay_before })),
    ];

    const periodsToCreate = [];
    for (const item of allItems) {
      const userId = item.user_id;

      const date = new Date(item.date);
      const { start, end } = getFortnightRange(date);
      const key = `${userId}_${start.toISOString()}`;
      
      if (!periodMap[key]) {
        const periodId = uuidv4();
        periodMap[key] = { id: periodId };
        periodsToCreate.push({
          id: periodId,
          user_id: userId,
          type: 'FORTNIGHTLY',
          start_date: start,
          end_date: end,
          created_at: new Date(),
          updated_at: new Date(),
        });
      }
    }
    
    if (periodsToCreate.length > 0) {
      await queryInterface.bulkInsert('periods', periodsToCreate);
    }

    for (const income of incomes) {
      const date = new Date(income.payment_date);
      const { start } = getFortnightRange(date);
      const key = `${income.user_id}_${start.toISOString()}`;
      const period = periodMap[key];
      if (period) {
        await queryInterface.sequelize.query(`
          UPDATE incomes SET period_id = '${period.id}' WHERE id = '${income.id}'
        `);
      }
    }

    for (const expense of expenses) {
      const date = new Date(expense.pay_before);
      const { start } = getFortnightRange(date);
      const key = `${expense.user_id}_${start.toISOString()}`;
      const period = periodMap[key];
      if (period) {
        await queryInterface.sequelize.query(`
          UPDATE expenses
          SET period_id = '${period.id}'
          WHERE id = '${expense.id}'
        `);
      }
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
