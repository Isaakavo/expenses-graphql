import { Sequelize, Transaction } from 'sequelize';
import { logger } from '../logger.js';
import { getProvider } from '../providers/provider-registry.js';
import {
  ProviderName,
  ProviderTransaction,
  ProviderTransactionSyncResult,
  TransactionProvider,
} from '../providers/provider.types.js';
import { CardRepository } from '../repository/card-repository.js';
import { PeriodRepository } from '../repository/period-repository.js';
import { ProviderConnectionRepository } from '../repository/provider-connection-repository.js';
import {
  StagedTransactionRepository,
  StagedTransactionUpdateFields,
} from '../repository/staged-transaction-repository.js';
import { decryptToken } from '../security/token-cipher.js';
import {
  CategorySuggestionService,
  RecentExpenseForSuggestion,
} from './category-suggestion-service.js';

const MAX_SYNC_PAGES = 100;

export type CardSyncResult = {
  cardId: string;
  newTransactions: number;
  updatedTransactions: number;
  syncedAt: Date;
  error?: string;
};

type SyncOutcome = 'CREATED' | 'UPDATED' | 'UNCHANGED';

type LinkedCard = {
  id: string;
  provider: string;
  providerAccountId: string;
  providerConnectionId: string;
  providerAccessTokenCiphertext: string;
  providerAccessTokenIv: string;
  providerAccessTokenAuthTag: string;
  providerStatus?: string;
};

export class TransactionSyncService {
  private cardRepository: CardRepository;
  private providerConnectionRepository: ProviderConnectionRepository;
  private stagedTransactionRepository: StagedTransactionRepository;
  private periodRepository: PeriodRepository;
  private categorySuggestionService: CategorySuggestionService;
  userId: string;
  sequelize: Sequelize;

  constructor(userId: string, sequelize: Sequelize) {
    this.cardRepository = new CardRepository();
    this.providerConnectionRepository = new ProviderConnectionRepository();
    this.stagedTransactionRepository = new StagedTransactionRepository();
    this.periodRepository = new PeriodRepository(userId, sequelize);
    this.categorySuggestionService = new CategorySuggestionService(userId, sequelize);
    this.userId = userId;
    this.sequelize = sequelize;
  }

  async syncCard(cardId: string): Promise<CardSyncResult> {
    const linkedCards = (await this.cardRepository.findLinkedCards(
      this.userId
    )) as unknown as LinkedCard[];
    const card = linkedCards.find((linkedCard) => linkedCard.id === cardId);

    if (!card) {
      throw new Error(`Card ${cardId} is not linked to a provider`);
    }

    if (card.providerStatus === 'DISCONNECTED') {
      throw new Error(`Card ${cardId} is disconnected from its provider`);
    }

    const siblingCards = linkedCards.filter(
      (linkedCard) =>
        linkedCard.provider === card.provider &&
        linkedCard.providerConnectionId === card.providerConnectionId
    );

    const results = await this.syncConnection(card.provider, siblingCards);
    const result = results.find((entry) => entry.cardId === cardId);

    if (!result) {
      throw new Error(`Card ${cardId} was not part of its own connection sync`);
    }

    return result;
  }

  async syncAllLinkedCards(): Promise<CardSyncResult[]> {
    const linkedCards = (await this.cardRepository.findLinkedCards(
      this.userId
    )) as unknown as LinkedCard[];
    const syncableCards = linkedCards.filter(
      (card) => card.providerStatus !== 'DISCONNECTED'
    );

    const connectionGroups = syncableCards.reduce<Record<string, LinkedCard[]>>(
      (acc, card) => {
        const key = `${card.provider}:${card.providerConnectionId}`;
        acc[key] = [...(acc[key] ?? []), card];
        return acc;
      },
      {}
    );

    const resultsByConnection = await Promise.all(
      Object.values(connectionGroups).map((cards) =>
        this.syncConnection(cards[0].provider, cards).catch((error) => {
          logger.error(
            `Error syncing connection ${cards[0].provider}:${cards[0].providerConnectionId}: ${error.message}`
          );
          return cards.map((card) => ({
            cardId: card.id,
            newTransactions: 0,
            updatedTransactions: 0,
            syncedAt: new Date(),
            error: error.message,
          })) as CardSyncResult[];
        })
      )
    );

    return resultsByConnection.flat();
  }

  private async syncConnection(
    provider: string,
    siblingCards: LinkedCard[]
  ): Promise<CardSyncResult[]> {
    const providerConnectionId = siblingCards[0].providerConnectionId;
    const dbTransaction = await this.sequelize.transaction();

    try {
      const results = await this.runSync(provider, providerConnectionId, siblingCards, dbTransaction);
      await dbTransaction.commit();
      return results;
    } catch (error) {
      await dbTransaction.rollback();
      await this.markCardsErrored(siblingCards.map((card) => card.id));
      logger.error(
        `Error syncing connection ${provider}:${providerConnectionId}: ${error.message}`
      );
      throw error;
    }
  }

  private async markCardsErrored(cardIds: string[]): Promise<void> {
    const errorTransaction = await this.sequelize.transaction();

    try {
      await cardIds.reduce<Promise<unknown>>(async (previousPromise, cardId) => {
        await previousPromise;
        return this.cardRepository.updateProviderSyncMetadata(
          cardId,
          this.userId,
          { providerStatus: 'ERROR' },
          { transaction: errorTransaction }
        );
      }, Promise.resolve());
      await errorTransaction.commit();
    } catch (markError) {
      await errorTransaction.rollback();
      logger.error(`Error marking cards as ERROR: ${markError.message}`);
    }
  }

  private async runSync(
    provider: string,
    providerConnectionId: string,
    siblingCards: LinkedCard[],
    dbTransaction: Transaction
  ): Promise<CardSyncResult[]> {
    const lockedConnection = await this.providerConnectionRepository.findForUpdate(
      { userId: this.userId, provider, providerConnectionId },
      { transaction: dbTransaction }
    );

    const connection =
      lockedConnection ??
      (
        await this.providerConnectionRepository.findOrCreate(
          { userId: this.userId, provider, providerConnectionId },
          { transaction: dbTransaction }
        )
      )[0];

    const accessToken = decryptToken({
      ciphertext: siblingCards[0].providerAccessTokenCiphertext,
      iv: siblingCards[0].providerAccessTokenIv,
      authTag: siblingCards[0].providerAccessTokenAuthTag,
    });

    const providerClient = getProvider(provider as ProviderName);

    const { transactions, removedProviderTransactionIds, nextCursor } =
      await this.collectTransactions(providerClient, accessToken, connection.syncCursor ?? null);

    const cardsByProviderAccountId = siblingCards.reduce<Record<string, LinkedCard>>(
      (acc, card) => {
        acc[card.providerAccountId] = card;
        return acc;
      },
      {}
    );

    const recentExpenses = transactions.length
      ? await this.categorySuggestionService.getRecentHistory()
      : [];

    const outcomes = await transactions.reduce(
      async (previousPromise, providerTransaction) => {
        const previous = await previousPromise;
        const card = cardsByProviderAccountId[providerTransaction.providerAccountId];
        if (!card) {
          return previous;
        }
        const outcome = await this.ingestTransaction(
          card,
          provider,
          providerTransaction,
          recentExpenses,
          dbTransaction
        );
        return [...previous, { cardId: card.id, outcome }];
      },
      Promise.resolve([] as Array<{ cardId: string; outcome: SyncOutcome }>)
    );

    await removedProviderTransactionIds.reduce<Promise<unknown>>(async (previousPromise, providerTransactionId) => {
      await previousPromise;
      return this.stagedTransactionRepository.deleteByProviderTransactionId(
        { cardIds: siblingCards.map((card) => card.id), providerTransactionId },
        { transaction: dbTransaction }
      );
    }, Promise.resolve());

    const syncedAt = new Date();

    await siblingCards.reduce<Promise<unknown>>(async (previousPromise, card) => {
      await previousPromise;
      const statusFields =
        card.providerStatus === 'ERROR' || !card.providerStatus
          ? { providerStatus: 'ACTIVE' as const }
          : {};
      return this.cardRepository.updateProviderSyncMetadata(
        card.id,
        this.userId,
        { ...statusFields, providerLastSyncedAt: syncedAt },
        { transaction: dbTransaction }
      );
    }, Promise.resolve());

    await this.providerConnectionRepository.updateCursor(
      { id: connection.id, cursor: nextCursor },
      { transaction: dbTransaction }
    );

    return siblingCards.map((card) => ({
      cardId: card.id,
      newTransactions: outcomes.filter(
        (entry) => entry.cardId === card.id && entry.outcome === 'CREATED'
      ).length,
      updatedTransactions: outcomes.filter(
        (entry) => entry.cardId === card.id && entry.outcome === 'UPDATED'
      ).length,
      syncedAt,
    }));
  }

  private async ingestTransaction(
    card: LinkedCard,
    provider: string,
    providerTransaction: ProviderTransaction,
    recentExpenses: RecentExpenseForSuggestion[],
    dbTransaction: Transaction
  ): Promise<SyncOutcome> {
    const suggestion = await this.categorySuggestionService.suggestSubCategory({
      cardId: card.id,
      description: providerTransaction.description,
      recentExpenses,
    });
    const period = await this.periodRepository.getPeriodBy(
      { date: providerTransaction.date },
      { transaction: dbTransaction }
    );

    const baseFields = {
      userId: this.userId,
      cardId: card.id,
      provider,
      description: providerTransaction.description,
      total: providerTransaction.amount,
      transactionDate: providerTransaction.date,
      providerPending: providerTransaction.pending,
      suggestedSubCategoryId: suggestion.subCategoryId,
      suggestedPeriodId: period?.id ?? null,
      suggestionSource: suggestion.source,
      rawPayload: providerTransaction.raw,
    };

    const updateFieldsFromBase: StagedTransactionUpdateFields = {
      description: baseFields.description,
      total: baseFields.total,
      transactionDate: baseFields.transactionDate,
      providerPending: baseFields.providerPending,
      suggestedSubCategoryId: baseFields.suggestedSubCategoryId,
      suggestedPeriodId: baseFields.suggestedPeriodId,
      suggestionSource: baseFields.suggestionSource,
      rawPayload: baseFields.rawPayload,
    };

    if (providerTransaction.pendingTransactionId) {
      const existingPending = await this.stagedTransactionRepository.findByCardAndProviderTransactionId(
        card.id,
        providerTransaction.pendingTransactionId,
        { transaction: dbTransaction }
      );

      if (existingPending) {
        if (existingPending.reviewStatus === 'PENDING') {
          await this.stagedTransactionRepository.updateFields(
            existingPending.id,
            {
              ...updateFieldsFromBase,
              providerTransactionId: providerTransaction.providerTransactionId,
            },
            { transaction: dbTransaction }
          );
          return 'UPDATED';
        }

        await this.stagedTransactionRepository.updateFields(
          existingPending.id,
          {
            providerTransactionId: providerTransaction.providerTransactionId,
            providerPending: providerTransaction.pending,
          },
          { transaction: dbTransaction }
        );
        return 'UPDATED';
      }
    }

    const { created, updated } = await this.stagedTransactionRepository.upsert(
      { ...baseFields, providerTransactionId: providerTransaction.providerTransactionId },
      { transaction: dbTransaction }
    );

    if (created) {
      return 'CREATED';
    }
    if (updated) {
      return 'UPDATED';
    }
    return 'UNCHANGED';
  }

  private async collectTransactions(
    provider: TransactionProvider,
    accessToken: string,
    initialCursor: string | null
  ): Promise<{
    transactions: ProviderTransaction[];
    removedProviderTransactionIds: string[];
    nextCursor: string;
  }> {
    const first = await provider.listTransactions({ accessToken, cursor: initialCursor });

    return this.collectRemainingPages(provider, accessToken, first, 1);
  }

  private async collectRemainingPages(
    provider: TransactionProvider,
    accessToken: string,
    accumulated: ProviderTransactionSyncResult,
    pageCount: number
  ): Promise<{
    transactions: ProviderTransaction[];
    removedProviderTransactionIds: string[];
    nextCursor: string;
  }> {
    if (!accumulated.hasMore) {
      return {
        transactions: accumulated.transactions,
        removedProviderTransactionIds: accumulated.removedProviderTransactionIds,
        nextCursor: accumulated.nextCursor,
      };
    }

    if (pageCount >= MAX_SYNC_PAGES) {
      throw new Error(
        `Exceeded maximum of ${MAX_SYNC_PAGES} pages while syncing transactions`
      );
    }

    const next = await provider.listTransactions({
      accessToken,
      cursor: accumulated.nextCursor,
    });

    return this.collectRemainingPages(
      provider,
      accessToken,
      {
        transactions: [...accumulated.transactions, ...next.transactions],
        removedProviderTransactionIds: [
          ...accumulated.removedProviderTransactionIds,
          ...next.removedProviderTransactionIds,
        ],
        nextCursor: next.nextCursor,
        hasMore: next.hasMore,
      },
      pageCount + 1
    );
  }
}
