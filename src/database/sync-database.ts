import { Income } from '../models/income.js';

export const syncTables = async () => {
  try {
    await Income.sync();
    console.log(`Synced tables ${Income.name}`);
  } catch (error) {
    console.error('Could not sync tables');
  }
}