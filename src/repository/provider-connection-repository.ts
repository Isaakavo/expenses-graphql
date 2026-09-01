import { Transaction } from 'sequelize';
import { ProviderConnection } from '../models/provider-connection.js';

export class ProviderConnectionRepository {
  async findOrCreate(
    input: { userId: string; provider: string; providerConnectionId: string },
    options: { transaction?: Transaction } = {}
  ): Promise<[ProviderConnection, boolean]> {
    return ProviderConnection.findOrCreate({
      where: {
        userId: input.userId,
        provider: input.provider,
        providerConnectionId: input.providerConnectionId,
      },
      defaults: input,
      transaction: options.transaction,
    });
  }

  async updateCursor(
    input: { id: string; cursor: string | null },
    options: { transaction?: Transaction } = {}
  ) {
    return ProviderConnection.update(
      { syncCursor: input.cursor },
      { where: { id: input.id }, transaction: options.transaction }
    );
  }

  async resetCursor(
    input: { id: string },
    options: { transaction?: Transaction } = {}
  ) {
    return this.updateCursor({ id: input.id, cursor: null }, options);
  }

  async findForUpdate(
    input: { userId: string; provider: string; providerConnectionId: string },
    options: { transaction?: Transaction } = {}
  ): Promise<ProviderConnection | null> {
    return ProviderConnection.findOne({
      where: {
        userId: input.userId,
        provider: input.provider,
        providerConnectionId: input.providerConnectionId,
      },
      transaction: options.transaction,
      lock: options.transaction?.LOCK.UPDATE,
    });
  }
}
