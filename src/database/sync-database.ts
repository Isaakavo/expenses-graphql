import { DataTypes, Sequelize } from 'sequelize';
import { ExpenseTags } from '../models/expense-tags.js';
import { Expense } from '../models/expense.js';
import { Income } from '../models/income.js';
import { Tag } from '../models/tag.js';
import { sequelize } from './client.js';
import { Card } from '../models/card.js';

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
    Tag.init(
      {
        id: {
          type: DataTypes.UUID,
          defaultValue: DataTypes.UUIDV4,
          primaryKey: true,
        },
        name: {
          type: DataTypes.STRING,
          allowNull: false,
          unique: true,
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

    ExpenseTags.init(
      {
        pk_expenses_tags: {
          type: DataTypes.UUID,
          defaultValue: DataTypes.UUIDV4,
          primaryKey: true,
        },
        expenseId: {
          type: DataTypes.UUID,
          defaultValue: DataTypes.UUIDV4,
          allowNull: false,
        },
        tagId: {
          type: DataTypes.UUID,
          defaultValue: DataTypes.UUIDV4,
          allowNull: false,
        },
      },
      { sequelize, timestamps: false }
    );

    Income.hasMany(Expense, {
      onDelete: 'CASCADE',
      foreignKey: 'incomeId',
      as: 'expenses',
    });
    Expense.belongsTo(Income, { foreignKey: 'incomeId' });
    Expense.belongsToMany(Tag, { through: ExpenseTags });
    Tag.belongsToMany(Expense, { through: ExpenseTags });
    Card.hasMany(Expense, {
      foreignKey: 'cardId',
      as: 'cards',
    });
    Expense.belongsTo(Card, { foreignKey: 'cardId' });

    // const seq = await sequelize.sync({ force: true });
    await sequelize.sync();
    console.log(`Synced tables ${Income.name}, ${Tag.name}, ${Expense.name}`);
  } catch (error) {
    console.error('Could not sync tables', error);
  }
};
