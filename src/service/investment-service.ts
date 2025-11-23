import {InvestmentRepository} from '../repository/investment-repository.js';
import {Sequelize} from 'sequelize';
import {fetchTodayUdiValue, UdiDatosResponse} from '../clients/banxico/udi-client.js';

export class InvestmentService {
  private investmentRepository: InvestmentRepository;
  userId: string;
  sequelize: Sequelize;

  constructor(userId: string, sequelize: Sequelize) {
    this.userId = userId;
    this.sequelize = sequelize;
    this.investmentRepository = new InvestmentRepository(userId, sequelize);
  }

  async getAllInvestmentRecords() {
    return this.investmentRepository.getAllInvestmentRecords();
  }

  async fetchUdiValue(): Promise<UdiDatosResponse> {
    const result = (await fetchTodayUdiValue()).bmx.series[0].datos[0]
    return {
      dato: result.dato,
      fecha: result.fecha
    }
  }
}