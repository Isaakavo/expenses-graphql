import { Category } from '../models/category.js';
import { Op, Sequelize } from 'sequelize';

export class CategoryRepository {
  userId: string;
  sequelize: Sequelize;

  constructor(userId: string, sequelize: Sequelize) {
    (this.userId = userId), (this.sequelize = sequelize);
  }

  async getCategoryList() {
    return Category.findAll({
      where: { [Op.or]: [{ userId: null }, { userId: this.userId }] },
    });
  }
}
