import { Op, Transaction, WhereOptions } from 'sequelize';
import { Card } from '../models/card.js';
import { Category } from '../models/category.js';
import { Expense } from '../models/expense.js';
import { Period } from '../models/periods.js';
import { StagedTransaction } from '../models/staged-transaction.js';
import { SubCategory } from '../models/sub-category.js';

export type StagedTransactionUpsertInput = {
  userId: string;
  cardId: string;
  provider: string;
  providerTransactionId: string;
  description: string;
  total: number;
  transactionDate: Date;
  providerPending: boolean;
  suggestedSubCategoryId?: string | null;
  suggestedPeriodId?: string | null;
  suggestionSource?: string | null;
  rawPayload?: unknown;
};

export type StagedTransactionUpdateFields = {
  providerTransactionId?: string;
  description?: string;
  total?: number;
  transactionDate?: Date;
  providerPending?: boolean;
  suggestedSubCategoryId?: string | null;
  suggestedPeriodId?: string | null;
  suggestionSource?: string | null;
  rawPayload?: unknown;
};

const CARD_ATTRIBUTES = [
  'id',
  'userId',
  'alias',
  'bank',
  'isDigital',
  'isDebit',
  'provider',
  'providerStatus',
  'providerLinkedAt',
  'providerLastSyncedAt',
];

export type StagedTransactionWithAssociations = StagedTransaction & {
  card: Card;
  suggested_sub_category?: SubCategory | null;
  suggested_period?: Period | null;
  promoted_expense?:
    | (Expense & {
      card?: Card | null;
      sub_category?: (SubCategory & { category?: Category }) | null;
    })
    | null;
};

const STAGED_TRANSACTION_INCLUDES = [
  { model: Card, as: 'card', attributes: CARD_ATTRIBUTES },
  { model: SubCategory, as: 'suggested_sub_category' },
  { model: Period, as: 'suggested_period' },
  {
    model: Expense,
    as: 'promoted_expense',
    include: [
      { model: Card, as: 'card', attributes: CARD_ATTRIBUTES },
      {
        model: SubCategory,
        as: 'sub_category',
        include: [{ model: Category, as: 'category' }],
      },
    ],
  },
];

export class StagedTransactionRepository {
  async findByCardAndProviderTransactionId(
    cardId: string,
    providerTransactionId: string,
    options: { transaction?: Transaction } = {}
  ) {
    return StagedTransaction.findOne({
      where: { cardId, providerTransactionId },
      transaction: options.transaction,
    });
  }

  async create(
    input: StagedTransactionUpsertInput,
    options: { transaction?: Transaction } = {}
  ) {
    return StagedTransaction.create(
      { ...input },
      { transaction: options.transaction }
    );
  }

  async updateFields(
    id: string,
    fields: StagedTransactionUpdateFields,
    options: { transaction?: Transaction } = {}
  ) {
    await StagedTransaction.update(fields, {
      where: { id },
      transaction: options.transaction,
    });
    return StagedTransaction.findByPk(id, { transaction: options.transaction });
  }

  async upsert(
    input: StagedTransactionUpsertInput,
    options: { transaction?: Transaction } = {}
  ): Promise<{ row: StagedTransaction; created: boolean; updated: boolean }> {
    const existing = await this.findByCardAndProviderTransactionId(
      input.cardId,
      input.providerTransactionId,
      options
    );

    if (existing) {
      if (existing.reviewStatus !== 'PENDING') {
        return { row: existing, created: false, updated: false };
      }

      const row = await this.updateFields(
        existing.id,
        {
          description: input.description,
          total: input.total,
          transactionDate: input.transactionDate,
          providerPending: input.providerPending,
          suggestedSubCategoryId: input.suggestedSubCategoryId ?? null,
          suggestedPeriodId: input.suggestedPeriodId ?? null,
          suggestionSource: input.suggestionSource ?? null,
          rawPayload: input.rawPayload ?? null,
        },
        options
      );

      return { row, created: false, updated: true };
    }

    const row = await this.create(input, options);
    return { row, created: true, updated: false };
  }

  async deleteByProviderTransactionId(
    input: { cardIds: string[]; providerTransactionId: string },
    options: { transaction?: Transaction } = {}
  ): Promise<number> {
    return StagedTransaction.destroy({
      where: {
        cardId: { [Op.in]: input.cardIds },
        providerTransactionId: input.providerTransactionId,
        reviewStatus: 'PENDING',
      },
      transaction: options.transaction,
    });
  }

  async findByFilter(input: {
    userId: string;
    cardId?: string;
    reviewStatus?: string;
  }): Promise<StagedTransactionWithAssociations[]> {
    const where: WhereOptions = { userId: input.userId };

    if (input.cardId) {
      where['cardId'] = input.cardId;
    }
    if (input.reviewStatus) {
      where['reviewStatus'] = input.reviewStatus;
    }

    const rows = await StagedTransaction.findAll({
      where,
      include: STAGED_TRANSACTION_INCLUDES,
      order: [['transactionDate', 'DESC']],
    });

    return rows as unknown as StagedTransactionWithAssociations[];
  }

  async findById(
    id: string,
    userId: string
  ): Promise<StagedTransactionWithAssociations | null> {
    const row = await StagedTransaction.findOne({
      where: { id, userId },
      include: STAGED_TRANSACTION_INCLUDES,
    });

    return row as unknown as StagedTransactionWithAssociations | null;
  }
}
