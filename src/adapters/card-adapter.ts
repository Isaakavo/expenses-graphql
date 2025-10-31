import { CardDTO } from '../dto/card-dto';

export const adaptCardDTO = (card): CardDTO => {
  return {
    id: card.id,
    userId: card.userId,
    bank: card.bank,
    alias: card.alias,
    isDebit: card.isDebit,
    isDigital: card.isDigital,
  };
};
