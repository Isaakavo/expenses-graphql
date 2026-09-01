import { adaptStagedTransactionDTO } from '../../../adapters/staged-transaction-adapter.js';
import { QueryResolvers } from '../../../generated/graphql.js';
import { StagedTransactionRepository } from '../../../repository/staged-transaction-repository.js';

export const stagedTransactions: QueryResolvers['stagedTransactions'] = async (
  _,
  { input },
  context
) => {
  const {
    user: { userId },
  } = context;

  const repository = new StagedTransactionRepository();
  const rows = await repository.findByFilter({
    userId,
    cardId: input?.cardId ?? undefined,
    reviewStatus: input?.reviewStatus ?? undefined,
  });

  return rows.map(adaptStagedTransactionDTO);
};
