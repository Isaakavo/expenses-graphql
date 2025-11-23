import {InvestmentRecord} from '../generated/graphql.js';
import {InvestmentRecord as InvestmentRecordModel } from 'models/investment-record.js'
import {InvestmentDto} from '../dto/investment-dto.js';
import {formatCurrency} from './income-adapter.js';
import { formatInTimeZone } from 'date-fns-tz';

export const adaptInvestment = (investmentRecordDTO: InvestmentDto): InvestmentRecord => {
  return {
    id: investmentRecordDTO.id,
    userId: investmentRecordDTO.userId,
    amount: formatCurrency(investmentRecordDTO.amount),
    udiAmount: investmentRecordDTO.udiAmount,
    udiValue: formatCurrency(investmentRecordDTO.udiValue),
    purchasedOn: formatInTimeZone(investmentRecordDTO.purchasedOn, 'UTC', 'dd MMM yyyy'),
  }
}

export const adaptInvestmentDTO = (investmentRecord: InvestmentRecordModel) => {
  return {
    id: investmentRecord.id,
    userId: investmentRecord.userId,
    amount: investmentRecord.amount,
    udiAmount: investmentRecord.udiAmount,
    udiValue: investmentRecord.udiValue,
    purchasedOn: investmentRecord.purchasedOn,
  }
}