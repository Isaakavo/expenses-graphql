import { DataTypes, Model, Op, Sequelize } from 'sequelize';

export class Card extends Model {
  public id!: string;
  public userId!: string;
  public bank!: string;
  public alias!: string;
  public isDebit!: boolean;
  public isDigital!: boolean;
  public provider?: string;
  public providerAccountId?: string;
  public providerConnectionId?: string;
  public providerAccessTokenCiphertext?: string;
  public providerAccessTokenIv?: string;
  public providerAccessTokenAuthTag?: string;
  public providerStatus?: string;
  public providerLinkedAt?: Date;
  public providerLastSyncedAt?: Date;
}

export const initCardModel = (sequelize: Sequelize) => {
  Card.init(
    {
      id: {
        type: DataTypes.UUID,
        defaultValue: DataTypes.UUIDV4,
        primaryKey: true,
      },
      userId: {
        type: DataTypes.STRING,
        allowNull: false,
      },
      // change with alias
      alias: {
        type: DataTypes.STRING,
        allowNull: true,
      },
      bank: {
        type: DataTypes.STRING,
        allowNull: false,
      },
      isDigital: {
        type: DataTypes.BOOLEAN,
      },
      isDebit: {
        type: DataTypes.BOOLEAN,
      },
      provider: {
        type: DataTypes.STRING,
        allowNull: true,
      },
      providerAccountId: {
        type: DataTypes.STRING,
        allowNull: true,
      },
      providerConnectionId: {
        type: DataTypes.STRING,
        allowNull: true,
      },
      providerAccessTokenCiphertext: {
        type: DataTypes.TEXT,
        allowNull: true,
      },
      providerAccessTokenIv: {
        type: DataTypes.STRING,
        allowNull: true,
      },
      providerAccessTokenAuthTag: {
        type: DataTypes.STRING,
        allowNull: true,
      },
      providerStatus: {
        type: DataTypes.STRING,
        allowNull: true,
      },
      providerLinkedAt: {
        type: DataTypes.DATE,
        allowNull: true,
      },
      providerLastSyncedAt: {
        type: DataTypes.DATE,
        allowNull: true,
      },
    },
    {
      sequelize,
      indexes: [
        {
          unique: true,
          fields: ['provider', 'providerAccountId'],
          where: { providerAccountId: { [Op.ne]: null } },
          name: 'unique_provider_account_per_provider',
        },
      ],
    }
  );
};
