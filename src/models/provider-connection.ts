import { DataTypes, Model, Sequelize } from 'sequelize';

export class ProviderConnection extends Model {
  public id!: string;
  public userId!: string;
  public provider!: string;
  public providerConnectionId!: string;
  public syncCursor?: string | null;
  public createdAt!: Date;
  public updatedAt!: Date;
}

export const initProviderConnectionModel = (sequelize: Sequelize) => {
  ProviderConnection.init(
    {
      id: {
        type: DataTypes.UUID,
        defaultValue: DataTypes.UUIDV4,
        primaryKey: true,
      },
      userId: {
        type: DataTypes.UUID,
        allowNull: false,
        field: 'user_id',
      },
      provider: {
        type: DataTypes.STRING,
        allowNull: false,
      },
      providerConnectionId: {
        type: DataTypes.STRING,
        allowNull: false,
        field: 'provider_connection_id',
      },
      syncCursor: {
        type: DataTypes.TEXT,
        allowNull: true,
        field: 'sync_cursor',
      },
      createdAt: {
        type: DataTypes.DATE,
        allowNull: false,
        field: 'created_at',
      },
      updatedAt: {
        type: DataTypes.DATE,
        allowNull: false,
        field: 'updated_at',
      },
    },
    {
      sequelize,
      underscored: true,
      indexes: [
        {
          unique: true,
          fields: ['provider', 'provider_connection_id'],
          name: 'unique_provider_connection',
        },
      ],
    }
  );
};
