import { CategoryRepository } from '../repository/category-repository.js';
import { Sequelize } from 'sequelize';

export class CategoryService {
  userId: string;
  sequelize: Sequelize;
  private categoryRepository: CategoryRepository;

  constructor(userId: string, sequelize: Sequelize) {
    this.userId = userId;
    this.sequelize = sequelize;
    this.categoryRepository = new CategoryRepository(userId, sequelize);
  }

  async getCategoryList() {
    return this.categoryRepository.getCategoryList();
  }
}
