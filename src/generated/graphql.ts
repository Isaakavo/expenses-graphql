import { Date } from '../scalars/date';
import { GraphQLResolveInfo, GraphQLScalarType, GraphQLScalarTypeConfig } from 'graphql';
import { Context } from '../index';
export type Maybe<T> = T | null;
export type InputMaybe<T> = Maybe<T>;
export type Exact<T extends { [key: string]: unknown }> = { [K in keyof T]: T[K] };
export type MakeOptional<T, K extends keyof T> = Omit<T, K> & { [SubKey in K]?: Maybe<T[SubKey]> };
export type MakeMaybe<T, K extends keyof T> = Omit<T, K> & { [SubKey in K]: Maybe<T[SubKey]> };
export type MakeEmpty<T extends { [key: string]: unknown }, K extends keyof T> = { [_ in K]?: never };
export type Incremental<T> = T | { [P in keyof T]?: P extends ' $fragmentName' | '__typename' ? T[P] : never };
export type RequireFields<T, K extends keyof T> = Omit<T, K> & { [P in K]-?: NonNullable<T[P]> };
/** All built-in and custom scalars, mapped to their actual values */
export type Scalars = {
  ID: { input: string; output: string; }
  String: { input: string; output: string; }
  Boolean: { input: boolean; output: boolean; }
  Int: { input: number; output: number; }
  Float: { input: number; output: number; }
  Date: { input: Date; output: Date; }
};

export type Card = {
  __typename?: 'Card';
  bank: Scalars['String']['output'];
  id: Scalars['ID']['output'];
  isDigital?: Maybe<Scalars['Boolean']['output']>;
  number?: Maybe<Scalars['String']['output']>;
  userId: Scalars['ID']['output'];
};

export type CreateCardInput = {
  bank: Scalars['String']['input'];
  isDigital?: InputMaybe<Scalars['Boolean']['input']>;
  number?: InputMaybe<Scalars['String']['input']>;
};

export type CreateExpenseInput = {
  cardId?: InputMaybe<Scalars['ID']['input']>;
  comment?: InputMaybe<Scalars['String']['input']>;
  concept: Scalars['String']['input'];
  incomeId: Scalars['ID']['input'];
  payBefore: Scalars['Date']['input'];
  tags: Array<ExpenseTagInput>;
  total: Scalars['Float']['input'];
};

export type Expense = {
  __typename?: 'Expense';
  card?: Maybe<Card>;
  comment?: Maybe<Scalars['String']['output']>;
  concept: Scalars['String']['output'];
  createdAt?: Maybe<Scalars['Date']['output']>;
  id: Scalars['ID']['output'];
  incomeId: Scalars['ID']['output'];
  payBefore: Scalars['Date']['output'];
  tags: Array<ExpenseTag>;
  total: Scalars['Float']['output'];
  updatedAt?: Maybe<Scalars['Date']['output']>;
  userId?: Maybe<Scalars['String']['output']>;
};

export type ExpenseTag = {
  __typename?: 'ExpenseTag';
  createdAt?: Maybe<Scalars['Date']['output']>;
  id: Scalars['ID']['output'];
  name: Scalars['String']['output'];
  updatedAt?: Maybe<Scalars['Date']['output']>;
};

export type ExpenseTagInput = {
  name?: InputMaybe<Scalars['String']['input']>;
};

export type FinancialBalance = {
  __typename?: 'FinancialBalance';
  debts: Scalars['Float']['output'];
  remaining: Scalars['Float']['output'];
};

export enum Fortnight {
  First = 'FIRST',
  Second = 'SECOND'
}

export type Income = {
  __typename?: 'Income';
  comment?: Maybe<Scalars['String']['output']>;
  createdAt?: Maybe<Scalars['Date']['output']>;
  id: Scalars['ID']['output'];
  paymentDate: PaymentDate;
  total: Scalars['Float']['output'];
  userId: Scalars['String']['output'];
};

export type IncomeListAndExpenses = {
  __typename?: 'IncomeListAndExpenses';
  expenses?: Maybe<Array<Expense>>;
  expensesTotal?: Maybe<Scalars['Float']['output']>;
  income: Income;
  remaining?: Maybe<Scalars['Float']['output']>;
};

export type IncomeTotalByMonth = {
  __typename?: 'IncomeTotalByMonth';
  date: Scalars['String']['output'];
  total: Scalars['Float']['output'];
};

export type IncomesAndExpensesByFortnightInput = {
  incomeId: Scalars['ID']['input'];
  payBefore: Scalars['Date']['input'];
};

export type IncomesList = {
  __typename?: 'IncomesList';
  incomes: Array<Income>;
  total: Scalars['Float']['output'];
  totalByMonth: Array<IncomeTotalByMonth>;
};

export type Mutation = {
  __typename?: 'Mutation';
  createCard?: Maybe<Card>;
  createExpense?: Maybe<Expense>;
  createIncome: Income;
  deleteIncomeById?: Maybe<Scalars['Boolean']['output']>;
};


export type MutationCreateCardArgs = {
  input?: InputMaybe<CreateCardInput>;
};


export type MutationCreateExpenseArgs = {
  input: CreateExpenseInput;
};


export type MutationCreateIncomeArgs = {
  comment?: InputMaybe<Scalars['String']['input']>;
  paymentDate: Scalars['Date']['input'];
  total: Scalars['Float']['input'];
};


export type MutationDeleteIncomeByIdArgs = {
  id: Scalars['ID']['input'];
};

export type PaymentDate = {
  __typename?: 'PaymentDate';
  date: Scalars['Date']['output'];
  fortnight: Fortnight;
};

export type Query = {
  __typename?: 'Query';
  allExpenses?: Maybe<Array<Maybe<Expense>>>;
  cardById?: Maybe<Card>;
  cardList?: Maybe<Array<Maybe<Card>>>;
  expensesByFortnight?: Maybe<Array<Maybe<Expense>>>;
  expensesByMonth?: Maybe<Array<Maybe<Expense>>>;
  financialBalanceByFortnight?: Maybe<FinancialBalance>;
  incomeAndExpensesByFortnight: IncomeListAndExpenses;
  incomesByMonth?: Maybe<Array<Maybe<Income>>>;
  incomesList?: Maybe<IncomesList>;
  tags?: Maybe<Array<Maybe<ExpenseTag>>>;
};


export type QueryCardByIdArgs = {
  cardId: Scalars['ID']['input'];
};


export type QueryExpensesByFortnightArgs = {
  payBefore: Scalars['Date']['input'];
};


export type QueryExpensesByMonthArgs = {
  date: Scalars['Date']['input'];
};


export type QueryFinancialBalanceByFortnightArgs = {
  payBefore: Scalars['Date']['input'];
};


export type QueryIncomeAndExpensesByFortnightArgs = {
  input: IncomesAndExpensesByFortnightInput;
};


export type QueryIncomesByMonthArgs = {
  date: Scalars['Date']['input'];
};

export type WithIndex<TObject> = TObject & Record<string, any>;
export type ResolversObject<TObject> = WithIndex<TObject>;

export type ResolverTypeWrapper<T> = Promise<T> | T;


export type ResolverWithResolve<TResult, TParent, TContext, TArgs> = {
  resolve: ResolverFn<TResult, TParent, TContext, TArgs>;
};
export type Resolver<TResult, TParent = {}, TContext = {}, TArgs = {}> = ResolverFn<TResult, TParent, TContext, TArgs> | ResolverWithResolve<TResult, TParent, TContext, TArgs>;

export type ResolverFn<TResult, TParent, TContext, TArgs> = (
  parent: TParent,
  args: TArgs,
  context: TContext,
  info: GraphQLResolveInfo
) => Promise<TResult> | TResult;

export type SubscriptionSubscribeFn<TResult, TParent, TContext, TArgs> = (
  parent: TParent,
  args: TArgs,
  context: TContext,
  info: GraphQLResolveInfo
) => AsyncIterable<TResult> | Promise<AsyncIterable<TResult>>;

export type SubscriptionResolveFn<TResult, TParent, TContext, TArgs> = (
  parent: TParent,
  args: TArgs,
  context: TContext,
  info: GraphQLResolveInfo
) => TResult | Promise<TResult>;

export interface SubscriptionSubscriberObject<TResult, TKey extends string, TParent, TContext, TArgs> {
  subscribe: SubscriptionSubscribeFn<{ [key in TKey]: TResult }, TParent, TContext, TArgs>;
  resolve?: SubscriptionResolveFn<TResult, { [key in TKey]: TResult }, TContext, TArgs>;
}

export interface SubscriptionResolverObject<TResult, TParent, TContext, TArgs> {
  subscribe: SubscriptionSubscribeFn<any, TParent, TContext, TArgs>;
  resolve: SubscriptionResolveFn<TResult, any, TContext, TArgs>;
}

export type SubscriptionObject<TResult, TKey extends string, TParent, TContext, TArgs> =
  | SubscriptionSubscriberObject<TResult, TKey, TParent, TContext, TArgs>
  | SubscriptionResolverObject<TResult, TParent, TContext, TArgs>;

export type SubscriptionResolver<TResult, TKey extends string, TParent = {}, TContext = {}, TArgs = {}> =
  | ((...args: any[]) => SubscriptionObject<TResult, TKey, TParent, TContext, TArgs>)
  | SubscriptionObject<TResult, TKey, TParent, TContext, TArgs>;

export type TypeResolveFn<TTypes, TParent = {}, TContext = {}> = (
  parent: TParent,
  context: TContext,
  info: GraphQLResolveInfo
) => Maybe<TTypes> | Promise<Maybe<TTypes>>;

export type IsTypeOfResolverFn<T = {}, TContext = {}> = (obj: T, context: TContext, info: GraphQLResolveInfo) => boolean | Promise<boolean>;

export type NextResolverFn<T> = () => Promise<T>;

export type DirectiveResolverFn<TResult = {}, TParent = {}, TContext = {}, TArgs = {}> = (
  next: NextResolverFn<TResult>,
  parent: TParent,
  args: TArgs,
  context: TContext,
  info: GraphQLResolveInfo
) => TResult | Promise<TResult>;



/** Mapping between all available schema types and the resolvers types */
export type ResolversTypes = ResolversObject<{
  Boolean: ResolverTypeWrapper<Scalars['Boolean']['output']>;
  Card: ResolverTypeWrapper<Card>;
  CreateCardInput: CreateCardInput;
  CreateExpenseInput: CreateExpenseInput;
  Date: ResolverTypeWrapper<Scalars['Date']['output']>;
  Expense: ResolverTypeWrapper<Expense>;
  ExpenseTag: ResolverTypeWrapper<ExpenseTag>;
  ExpenseTagInput: ExpenseTagInput;
  FinancialBalance: ResolverTypeWrapper<FinancialBalance>;
  Float: ResolverTypeWrapper<Scalars['Float']['output']>;
  Fortnight: Fortnight;
  ID: ResolverTypeWrapper<Scalars['ID']['output']>;
  Income: ResolverTypeWrapper<Income>;
  IncomeListAndExpenses: ResolverTypeWrapper<IncomeListAndExpenses>;
  IncomeTotalByMonth: ResolverTypeWrapper<IncomeTotalByMonth>;
  IncomesAndExpensesByFortnightInput: IncomesAndExpensesByFortnightInput;
  IncomesList: ResolverTypeWrapper<IncomesList>;
  Mutation: ResolverTypeWrapper<{}>;
  PaymentDate: ResolverTypeWrapper<PaymentDate>;
  Query: ResolverTypeWrapper<{}>;
  String: ResolverTypeWrapper<Scalars['String']['output']>;
}>;

/** Mapping between all available schema types and the resolvers parents */
export type ResolversParentTypes = ResolversObject<{
  Boolean: Scalars['Boolean']['output'];
  Card: Card;
  CreateCardInput: CreateCardInput;
  CreateExpenseInput: CreateExpenseInput;
  Date: Scalars['Date']['output'];
  Expense: Expense;
  ExpenseTag: ExpenseTag;
  ExpenseTagInput: ExpenseTagInput;
  FinancialBalance: FinancialBalance;
  Float: Scalars['Float']['output'];
  ID: Scalars['ID']['output'];
  Income: Income;
  IncomeListAndExpenses: IncomeListAndExpenses;
  IncomeTotalByMonth: IncomeTotalByMonth;
  IncomesAndExpensesByFortnightInput: IncomesAndExpensesByFortnightInput;
  IncomesList: IncomesList;
  Mutation: {};
  PaymentDate: PaymentDate;
  Query: {};
  String: Scalars['String']['output'];
}>;

export type CardResolvers<ContextType = Context, ParentType extends ResolversParentTypes['Card'] = ResolversParentTypes['Card']> = ResolversObject<{
  bank?: Resolver<ResolversTypes['String'], ParentType, ContextType>;
  id?: Resolver<ResolversTypes['ID'], ParentType, ContextType>;
  isDigital?: Resolver<Maybe<ResolversTypes['Boolean']>, ParentType, ContextType>;
  number?: Resolver<Maybe<ResolversTypes['String']>, ParentType, ContextType>;
  userId?: Resolver<ResolversTypes['ID'], ParentType, ContextType>;
  __isTypeOf?: IsTypeOfResolverFn<ParentType, ContextType>;
}>;

export interface DateScalarConfig extends GraphQLScalarTypeConfig<ResolversTypes['Date'], any> {
  name: 'Date';
}

export type ExpenseResolvers<ContextType = Context, ParentType extends ResolversParentTypes['Expense'] = ResolversParentTypes['Expense']> = ResolversObject<{
  card?: Resolver<Maybe<ResolversTypes['Card']>, ParentType, ContextType>;
  comment?: Resolver<Maybe<ResolversTypes['String']>, ParentType, ContextType>;
  concept?: Resolver<ResolversTypes['String'], ParentType, ContextType>;
  createdAt?: Resolver<Maybe<ResolversTypes['Date']>, ParentType, ContextType>;
  id?: Resolver<ResolversTypes['ID'], ParentType, ContextType>;
  incomeId?: Resolver<ResolversTypes['ID'], ParentType, ContextType>;
  payBefore?: Resolver<ResolversTypes['Date'], ParentType, ContextType>;
  tags?: Resolver<Array<ResolversTypes['ExpenseTag']>, ParentType, ContextType>;
  total?: Resolver<ResolversTypes['Float'], ParentType, ContextType>;
  updatedAt?: Resolver<Maybe<ResolversTypes['Date']>, ParentType, ContextType>;
  userId?: Resolver<Maybe<ResolversTypes['String']>, ParentType, ContextType>;
  __isTypeOf?: IsTypeOfResolverFn<ParentType, ContextType>;
}>;

export type ExpenseTagResolvers<ContextType = Context, ParentType extends ResolversParentTypes['ExpenseTag'] = ResolversParentTypes['ExpenseTag']> = ResolversObject<{
  createdAt?: Resolver<Maybe<ResolversTypes['Date']>, ParentType, ContextType>;
  id?: Resolver<ResolversTypes['ID'], ParentType, ContextType>;
  name?: Resolver<ResolversTypes['String'], ParentType, ContextType>;
  updatedAt?: Resolver<Maybe<ResolversTypes['Date']>, ParentType, ContextType>;
  __isTypeOf?: IsTypeOfResolverFn<ParentType, ContextType>;
}>;

export type FinancialBalanceResolvers<ContextType = Context, ParentType extends ResolversParentTypes['FinancialBalance'] = ResolversParentTypes['FinancialBalance']> = ResolversObject<{
  debts?: Resolver<ResolversTypes['Float'], ParentType, ContextType>;
  remaining?: Resolver<ResolversTypes['Float'], ParentType, ContextType>;
  __isTypeOf?: IsTypeOfResolverFn<ParentType, ContextType>;
}>;

export type IncomeResolvers<ContextType = Context, ParentType extends ResolversParentTypes['Income'] = ResolversParentTypes['Income']> = ResolversObject<{
  comment?: Resolver<Maybe<ResolversTypes['String']>, ParentType, ContextType>;
  createdAt?: Resolver<Maybe<ResolversTypes['Date']>, ParentType, ContextType>;
  id?: Resolver<ResolversTypes['ID'], ParentType, ContextType>;
  paymentDate?: Resolver<ResolversTypes['PaymentDate'], ParentType, ContextType>;
  total?: Resolver<ResolversTypes['Float'], ParentType, ContextType>;
  userId?: Resolver<ResolversTypes['String'], ParentType, ContextType>;
  __isTypeOf?: IsTypeOfResolverFn<ParentType, ContextType>;
}>;

export type IncomeListAndExpensesResolvers<ContextType = Context, ParentType extends ResolversParentTypes['IncomeListAndExpenses'] = ResolversParentTypes['IncomeListAndExpenses']> = ResolversObject<{
  expenses?: Resolver<Maybe<Array<ResolversTypes['Expense']>>, ParentType, ContextType>;
  expensesTotal?: Resolver<Maybe<ResolversTypes['Float']>, ParentType, ContextType>;
  income?: Resolver<ResolversTypes['Income'], ParentType, ContextType>;
  remaining?: Resolver<Maybe<ResolversTypes['Float']>, ParentType, ContextType>;
  __isTypeOf?: IsTypeOfResolverFn<ParentType, ContextType>;
}>;

export type IncomeTotalByMonthResolvers<ContextType = Context, ParentType extends ResolversParentTypes['IncomeTotalByMonth'] = ResolversParentTypes['IncomeTotalByMonth']> = ResolversObject<{
  date?: Resolver<ResolversTypes['String'], ParentType, ContextType>;
  total?: Resolver<ResolversTypes['Float'], ParentType, ContextType>;
  __isTypeOf?: IsTypeOfResolverFn<ParentType, ContextType>;
}>;

export type IncomesListResolvers<ContextType = Context, ParentType extends ResolversParentTypes['IncomesList'] = ResolversParentTypes['IncomesList']> = ResolversObject<{
  incomes?: Resolver<Array<ResolversTypes['Income']>, ParentType, ContextType>;
  total?: Resolver<ResolversTypes['Float'], ParentType, ContextType>;
  totalByMonth?: Resolver<Array<ResolversTypes['IncomeTotalByMonth']>, ParentType, ContextType>;
  __isTypeOf?: IsTypeOfResolverFn<ParentType, ContextType>;
}>;

export type MutationResolvers<ContextType = Context, ParentType extends ResolversParentTypes['Mutation'] = ResolversParentTypes['Mutation']> = ResolversObject<{
  createCard?: Resolver<Maybe<ResolversTypes['Card']>, ParentType, ContextType, Partial<MutationCreateCardArgs>>;
  createExpense?: Resolver<Maybe<ResolversTypes['Expense']>, ParentType, ContextType, RequireFields<MutationCreateExpenseArgs, 'input'>>;
  createIncome?: Resolver<ResolversTypes['Income'], ParentType, ContextType, RequireFields<MutationCreateIncomeArgs, 'paymentDate' | 'total'>>;
  deleteIncomeById?: Resolver<Maybe<ResolversTypes['Boolean']>, ParentType, ContextType, RequireFields<MutationDeleteIncomeByIdArgs, 'id'>>;
}>;

export type PaymentDateResolvers<ContextType = Context, ParentType extends ResolversParentTypes['PaymentDate'] = ResolversParentTypes['PaymentDate']> = ResolversObject<{
  date?: Resolver<ResolversTypes['Date'], ParentType, ContextType>;
  fortnight?: Resolver<ResolversTypes['Fortnight'], ParentType, ContextType>;
  __isTypeOf?: IsTypeOfResolverFn<ParentType, ContextType>;
}>;

export type QueryResolvers<ContextType = Context, ParentType extends ResolversParentTypes['Query'] = ResolversParentTypes['Query']> = ResolversObject<{
  allExpenses?: Resolver<Maybe<Array<Maybe<ResolversTypes['Expense']>>>, ParentType, ContextType>;
  cardById?: Resolver<Maybe<ResolversTypes['Card']>, ParentType, ContextType, RequireFields<QueryCardByIdArgs, 'cardId'>>;
  cardList?: Resolver<Maybe<Array<Maybe<ResolversTypes['Card']>>>, ParentType, ContextType>;
  expensesByFortnight?: Resolver<Maybe<Array<Maybe<ResolversTypes['Expense']>>>, ParentType, ContextType, RequireFields<QueryExpensesByFortnightArgs, 'payBefore'>>;
  expensesByMonth?: Resolver<Maybe<Array<Maybe<ResolversTypes['Expense']>>>, ParentType, ContextType, RequireFields<QueryExpensesByMonthArgs, 'date'>>;
  financialBalanceByFortnight?: Resolver<Maybe<ResolversTypes['FinancialBalance']>, ParentType, ContextType, RequireFields<QueryFinancialBalanceByFortnightArgs, 'payBefore'>>;
  incomeAndExpensesByFortnight?: Resolver<ResolversTypes['IncomeListAndExpenses'], ParentType, ContextType, RequireFields<QueryIncomeAndExpensesByFortnightArgs, 'input'>>;
  incomesByMonth?: Resolver<Maybe<Array<Maybe<ResolversTypes['Income']>>>, ParentType, ContextType, RequireFields<QueryIncomesByMonthArgs, 'date'>>;
  incomesList?: Resolver<Maybe<ResolversTypes['IncomesList']>, ParentType, ContextType>;
  tags?: Resolver<Maybe<Array<Maybe<ResolversTypes['ExpenseTag']>>>, ParentType, ContextType>;
}>;

export type Resolvers<ContextType = Context> = ResolversObject<{
  Card?: CardResolvers<ContextType>;
  Date?: GraphQLScalarType;
  Expense?: ExpenseResolvers<ContextType>;
  ExpenseTag?: ExpenseTagResolvers<ContextType>;
  FinancialBalance?: FinancialBalanceResolvers<ContextType>;
  Income?: IncomeResolvers<ContextType>;
  IncomeListAndExpenses?: IncomeListAndExpensesResolvers<ContextType>;
  IncomeTotalByMonth?: IncomeTotalByMonthResolvers<ContextType>;
  IncomesList?: IncomesListResolvers<ContextType>;
  Mutation?: MutationResolvers<ContextType>;
  PaymentDate?: PaymentDateResolvers<ContextType>;
  Query?: QueryResolvers<ContextType>;
}>;

