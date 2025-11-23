import {InvestmentRecordInput, InvestmentRepository} from '../repository/investment-repository.js';
import {Sequelize} from 'sequelize';
import {fetchTodayUdiValue, UdiDatosResponse} from '../clients/banxico/udi-client.js';
import {InvestmentDto} from '../dto/investment-dto';

export class InvestmentService {
  private investmentRepository: InvestmentRepository;
  userId: string;
  sequelize: Sequelize;

  constructor(userId: string, sequelize: Sequelize) {
    this.userId = userId;
    this.sequelize = sequelize;
    this.investmentRepository = new InvestmentRepository(userId, sequelize);
  }

  async createInvestmentRecord(input: InvestmentRecordInput): Promise<InvestmentDto> {
    const { amount, udiValue, purchasedOn } = input;
    const calculatedUdiValue = udiValue ?? Number((await this.fetchUdiValue()).dato)
    const totalOfUdis = amount / calculatedUdiValue;

    return await this.investmentRepository.createInvestmentRecord({
      amount,
      udiValue: calculatedUdiValue,
      udiAmount: totalOfUdis,
      purchasedOn,
    })
  }

  async getAllInvestmentRecords(): Promise<InvestmentDto[]> {
    const investmentFee = await this.investmentRepository.getInvestmentFee(1)
    const investments = await this.investmentRepository.getAllInvestmentRecords();

    return investments.map((investment) => (
      {
        ...investment,
        fee: investmentFee.udiCommission,
        conversion: investment.udiValue * investmentFee.monthlyBonus,
        feeConversion: investment.udiValue * investmentFee.udiCommission,
        monthlyBonus: investmentFee.monthlyBonus,
        udiCommission: investmentFee.udiCommission,
      }
    ))
  }

  async fetchUdiValue(): Promise<UdiDatosResponse> {
    const result = (await fetchTodayUdiValue()).bmx.series[0].datos[0]
    return {
      dato: result.dato,
      fecha: result.fecha
    }
  }
}