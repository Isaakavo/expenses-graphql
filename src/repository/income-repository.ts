import { Income } from '../models/index.js';
import { Period } from '../models/periods.js';

export class IncomeRepository {
  userId: string;

  constructor(userId: string) {
    this.userId = userId;
  }

  async getAllIncomes() {
    return Income.findAll({
      where: {
        userId: this.userId,
      },
      include: [
        {
          model: Period,
          as: 'period',
          where: {
            userId: this.userId,
          },
        },
      ],
      order: [['paymentDate', 'DESC']],
    });
  }
}
