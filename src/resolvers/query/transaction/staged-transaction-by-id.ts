import { adaptStagedTransactionDTO } from '../../../adapters/staged-transaction-adapter.js';
import { QueryResolvers } from '../../../generated/graphql.js';
import { StagedTransactionRepository } from '../../../repository/staged-transaction-repository.js';

export const stagedTransactionById: QueryResolvers['stagedTransactionById'] = async (
  _,
  { id },
  context
) => {
  const {
    user: { userId },
  } = context;

  const repository = new StagedTransactionRepository();
  const row = await repository.findById(id, userId);

  return row ? adaptStagedTransactionDTO(row) : null;
};
