import { Tag } from '../models/tag.js';
import { Income } from '../models/income.js';
import { Expense } from '../models/expense.js';
import { sequilize } from './client.js';
import { ExpenseTags } from '../models/expense-tags.js';

export const syncTables = async () => {
  try {
    await Income.sync({ force: true });
    await Tag.sync({ force: true });
    await Expense.sync({ force: true });

    Expense.belongsToMany(Tag, { through: ExpenseTags });
    Tag.belongsToMany(Expense, { through: ExpenseTags });

    await sequilize.sync({ force: true });

    console.log(`Synced tables ${Income.name}, ${Tag.name}, ${Expense.name}`);
  } catch (error) {
    console.error('Could not sync tables');
  }
};
