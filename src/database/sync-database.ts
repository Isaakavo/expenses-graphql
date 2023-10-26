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
          type: DataTypes.UUIDV4,
          primaryKey: true,
          defaultValue: Sequelize.literal('get_random_uuid()'),
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
          type: DataTypes.BIGINT,
          primaryKey: true,
          autoIncrement: true,
        },
        userId: {
          type: DataTypes.STRING,
          allowNull: false,
        },
        number: {
          type: DataTypes.STRING,
          allowNull: true,
        },
        bank: {
          type: DataTypes.STRING,
          allowNull: false,
        },
        cutDateDay: {
          type: DataTypes.STRING,
          allowNull: false,
        },
        limitPaymentDay: {
          type: DataTypes.STRING,
          allowNull: false,
        },
        creditLimit: {
          type: DataTypes.INTEGER,
          allowNull: true,
        },
      },
      { sequelize }
    );
    Tag.init(
      {
        id: {
          type: DataTypes.BIGINT,
          primaryKey: true,
          autoIncrement: true,
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
          type: DataTypes.BIGINT,
          primaryKey: true,
          autoIncrement: true,
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
          type: DataTypes.BIGINT,
          primaryKey: true,
          autoIncrement: true,
        },
        expenseId: {
          type: DataTypes.BIGINT,
          allowNull: false,
        },
        tagId: {
          type: DataTypes.BIGINT,
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
