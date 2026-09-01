import { adaptTransactionSyncResult } from '../../../adapters/staged-transaction-adapter.js';
import { MutationResolvers } from '../../../generated/graphql.js';
import { TransactionSyncService } from '../../../service/transaction-sync-service.js';

export const syncTransactions: MutationResolvers['syncTransactions'] = async (
  _,
  { input },
  context
) => {
  const {
    user: { userId },
    sequelizeClient,
  } = context;

  const service = new TransactionSyncService(userId, sequelizeClient);

  if (input?.cardId) {
    const result = await service.syncCard(input.cardId);
    return [adaptTransactionSyncResult(result)];
  }

  const results = await service.syncAllLinkedCards();
  return results.map(adaptTransactionSyncResult);
};
