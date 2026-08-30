import { DataTypes, ForeignKey, Model, Sequelize } from 'sequelize';
import { Card } from './card.js';
import { SubCategory } from './sub-category.js';
import { Period } from './periods.js';
import { Expense } from './expense.js';

export class StagedTransaction extends Model {
  public id!: string;
  public userId!: string;
  public cardId!: ForeignKey<string>;
  public provider!: string;
  public providerTransactionId!: string;
  public description!: string;
  public total!: number;
  public transactionDate!: Date;
  public providerPending!: boolean;
  public reviewStatus!: string;
  public suggestedSubCategoryId?: ForeignKey<string>;
  public suggestedPeriodId?: ForeignKey<string>;
  public suggestionSource?: string;
  public promotedExpenseId?: ForeignKey<string>;
  public rawPayload?: unknown;
  public createdAt!: Date;
  public updatedAt!: Date;

  static associate() {
    this.belongsTo(Card, { foreignKey: 'cardId', as: 'card' });
    this.belongsTo(SubCategory, {
      foreignKey: 'suggestedSubCategoryId',
      as: 'suggested_sub_category',
    });
    this.belongsTo(Period, {
      foreignKey: 'suggestedPeriodId',
      as: 'suggested_period',
    });
    this.belongsTo(Expense, {
      foreignKey: 'promotedExpenseId',
      as: 'promoted_expense',
    });
  }
}

export const initStagedTransactionModel = (sequelize: Sequelize) => {
  StagedTransaction.init(
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
      cardId: {
        type: DataTypes.UUID,
        allowNull: false,
        field: 'card_id',
        references: {
          model: 'Cards',
          key: 'id',
        },
        onDelete: 'CASCADE',
      },
      provider: {
        type: DataTypes.STRING,
        allowNull: false,
      },
      providerTransactionId: {
        type: DataTypes.STRING,
        allowNull: false,
        field: 'provider_transaction_id',
      },
      description: {
        type: DataTypes.STRING,
        allowNull: false,
      },
      total: {
        type: DataTypes.DECIMAL(12, 2),
        allowNull: false,
      },
      transactionDate: {
        type: DataTypes.DATE,
        allowNull: false,
        field: 'transaction_date',
      },
      providerPending: {
        type: DataTypes.BOOLEAN,
        allowNull: false,
        defaultValue: false,
        field: 'provider_pending',
      },
      reviewStatus: {
        type: DataTypes.STRING,
        allowNull: false,
        defaultValue: 'PENDING',
        field: 'review_status',
      },
      suggestedSubCategoryId: {
        type: DataTypes.UUID,
        allowNull: true,
        field: 'suggested_sub_category_id',
        references: {
          model: 'sub_categories',
          key: 'id',
        },
        onDelete: 'SET NULL',
      },
      suggestedPeriodId: {
        type: DataTypes.UUID,
        allowNull: true,
        field: 'suggested_period_id',
        references: {
          model: 'periods',
          key: 'id',
        },
        onDelete: 'SET NULL',
      },
      suggestionSource: {
        type: DataTypes.STRING,
        allowNull: true,
        field: 'suggestion_source',
      },
      promotedExpenseId: {
        type: DataTypes.UUID,
        allowNull: true,
        field: 'promoted_expense_id',
        references: {
          model: 'expenses',
          key: 'id',
        },
        onDelete: 'SET NULL',
      },
      rawPayload: {
        type: DataTypes.JSONB,
        allowNull: true,
        field: 'raw_payload',
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
          fields: ['card_id', 'provider_transaction_id'],
          name: 'unique_staged_transaction_per_card',
        },
      ],
    }
  );
};
