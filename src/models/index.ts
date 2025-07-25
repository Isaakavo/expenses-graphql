import { Card } from './card.js';
import { Expense } from './expense.js';
import { Income } from './income.js';
import { Period } from './period.js';

Card.hasMany(Expense, {
  foreignKey: 'cardId',
  as: 'cards',
});
Expense.belongsTo(Card, { foreignKey: 'cardId' });
Income.belongsTo(Period, { foreignKey: 'periodId' });
Period.hasMany(Income, { foreignKey: 'periodId' });
Expense.belongsTo(Period, { foreignKey: 'periodId' });
Period.hasMany(Expense, { foreignKey: 'periodId' });

export { Card, Expense, Income, Period };
