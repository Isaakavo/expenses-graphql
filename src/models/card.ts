import { Model } from "sequelize";


export class Card extends Model {
  public id!: number;
  public userId!: string;
  public bank!: string;
  public number!: string;
  public cutDateDay!: string;
  public limitPaymentDay!: string;
  public creditLimit!: number;
}