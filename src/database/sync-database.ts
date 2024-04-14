import { DataTypes } from 'sequelize';
import { Expense } from '../models/expense.js';
import { Income } from '../models/income.js';
import { sequelize } from './client.js';
import { Card } from '../models/card.js';
import { logger } from '../logger.js';
import { Category } from '../models/category.js';
export const syncTables = async () => {
  try {
    Income.init(
      {
        id: {
          type: DataTypes.UUID,
          defaultValue: DataTypes.UUIDV4,
          primaryKey: true,
        },
        total: {
          type: DataTypes.FLOAT,
          allowNull: false,
        },
        comment: {
          type: DataTypes.STRING,
          allowNull: true,
        },
        paymentDate: {
          type: DataTypes.DATE,
          allowNull: false,
        },
        userId: {
          type: DataTypes.STRING,
          allowNull: false,
        },
        createdAt: {
          type: DataTypes.DATE,
          allowNull: false,
        },
        updatedAt: {
          type: DataTypes.DATE,
        },
      },
      { sequelize, underscored: true }
    );
    Category.init(
      {
        id: {
          type: DataTypes.INTEGER,
          primaryKey: true,
          autoIncrement: true,
        },
        name: {
          type: DataTypes.STRING,
          allowNull: false,
        },
        createdAt: {
          type: DataTypes.DATE,
          allowNull: false,
        },
        updatedAt: {
          type: DataTypes.DATE,
          allowNull: false,
        },
      },
      { sequelize, underscored: true }  
    );
    // add payday limit to handle where the card should be paid
    Card.init(
      {
        id: {
          type: DataTypes.UUID,
          defaultValue: DataTypes.UUIDV4,
          primaryKey: true,
        },
        userId: {
          type: DataTypes.STRING,
          allowNull: false,
        },
        // change with alias
        alias: {
          type: DataTypes.STRING,
          allowNull: true,
        },
        bank: {
          type: DataTypes.STRING,
          allowNull: false,
        },
        isDigital: {
          type: DataTypes.BOOLEAN,
        },
        isDebit: {
          type: DataTypes.BOOLEAN,
        },
      },
      { sequelize }
    );
    Expense.init(
      {
        id: {
          type: DataTypes.UUID,
          defaultValue: DataTypes.UUIDV4,
          primaryKey: true,
        },
        userId: {
          type: DataTypes.STRING,
          allowNull: false,
        },
        categoryId: {
          type: DataTypes.INTEGER,
          allowNull: false,
        },
        concept: {
          type: DataTypes.STRING,
          allowNull: false,
        },
        total: {
          type: DataTypes.FLOAT,
          allowNull: false,
        },
        comments: {
          type: DataTypes.STRING,
          allowNull: true,
        },
        payBefore: {
          type: DataTypes.DATE,
          allowNull: false,
        },
        createdAt: {
          type: DataTypes.DATE,
          allowNull: false,
        },
        updatedAt: {
          type: DataTypes.DATE,
        },
      },
      { sequelize, underscored: true }
    );
    Card.hasMany(Expense, {
      foreignKey: 'cardId',
      as: 'cards',
    });
    Category.hasMany(Expense, {
      foreignKey: 'categoryId',
      as: 'categories',
    });
    Expense.belongsTo(Card, { foreignKey: 'cardId' });
    Expense.belongsTo(Category, { foreignKey: 'categoryId' });

    // await sequelize.sync({ force: true });
    await sequelize.sync({logging: true});
    logger.info('Synced tables', 'syncTables');
  } catch (error) {
    logger.error('Failed to sync tables', error);
  }
};
