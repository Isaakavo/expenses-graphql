import { Model } from "sequelize";


export class Card extends Model {
  public id!: string;
  public userId!: string;
  public bank!: string;
  public alias!: string;
  public isDebit!: boolean
  public isDigital!: boolean;
}
