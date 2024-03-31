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

export type AllExpensesByDateRangeInput = {
  endDate?: InputMaybe<EndDate>;
  initialDate?: InputMaybe<InitialDate>;
};

export type Card = {
  __typename?: 'Card';
  alias?: Maybe<Scalars['String']['output']>;
  bank: Scalars['String']['output'];
  id: Scalars['ID']['output'];
  isDebit?: Maybe<Scalars['Boolean']['output']>;
  isDigital?: Maybe<Scalars['Boolean']['output']>;
  userId: Scalars['ID']['output'];
};

export enum Category {
  BILLS = 'BILLS',
  CAR = 'CAR',
  CLOTHES = 'CLOTHES',
  COMMUNICATION = 'COMMUNICATION',
  EATING_OUT = 'EATING_OUT',
  ENTERTAINMENT = 'ENTERTAINMENT',
  FIXED_EXPENSE = 'FIXED_EXPENSE',
  FOOD = 'FOOD',
  GIFTS = 'GIFTS',
  HANG_OUT = 'HANG_OUT',
  HEALTH = 'HEALTH',
  HOUSE = 'HOUSE',
  INSURANCE = 'INSURANCE',
  MONTHS_WITHOUT_INTEREST = 'MONTHS_WITHOUT_INTEREST',
  PETS = 'PETS',
  SAVINGS = 'SAVINGS',
  SPORTS = 'SPORTS',
  SUBSCRIPTION = 'SUBSCRIPTION',
  SUPER_MARKET = 'SUPER_MARKET',
  TRANSPORT = 'TRANSPORT'
}

export type CreateCardInput = {
  alias?: InputMaybe<Scalars['String']['input']>;
  bank: Scalars['String']['input'];
  isDebit?: InputMaybe<Scalars['Boolean']['input']>;
  isDigital?: InputMaybe<Scalars['Boolean']['input']>;
};

export type CreateExpenseInput = {
  cardId?: InputMaybe<Scalars['ID']['input']>;
  category: Category;
  comment?: InputMaybe<Scalars['String']['input']>;
  concept: Scalars['String']['input'];
  payBefore: Scalars['Date']['input'];
  total: Scalars['Float']['input'];
};

export type CreateFixedExpenseInput = {
  cardId?: InputMaybe<Scalars['ID']['input']>;
  category: Category;
  comment?: InputMaybe<Scalars['String']['input']>;
  concept: Scalars['String']['input'];
  frequency?: InputMaybe<FixedExpenseFrequency>;
  numberOfMonthsOrWeeks: Scalars['Int']['input'];
  payBefore: Scalars['Date']['input'];
  total: Scalars['Float']['input'];
};

export type CreateIncomeInput = {
  comment?: InputMaybe<Scalars['String']['input']>;
  paymentDate: Scalars['Date']['input'];
  total: Scalars['Float']['input'];
};

export type Expense = {
  __typename?: 'Expense';
  card?: Maybe<Card>;
  category: Category;
  comment?: Maybe<Scalars['String']['output']>;
  concept: Scalars['String']['output'];
  createdAt?: Maybe<Scalars['Date']['output']>;
  id: Scalars['ID']['output'];
  payBefore: Scalars['Date']['output'];
  total: Scalars['Float']['output'];
  updatedAt?: Maybe<Scalars['Date']['output']>;
  userId?: Maybe<Scalars['String']['output']>;
};

export type ExpensesBy = {
  __typename?: 'ExpensesBy';
  expenses?: Maybe<Array<Maybe<Expense>>>;
  expensesTotal?: Maybe<Scalars['Float']['output']>;
};

export type FinancialBalance = {
  __typename?: 'FinancialBalance';
  debts: Scalars['Float']['output'];
  remaining: Scalars['Float']['output'];
};

export enum FixedExpenseFrequency {
  BIWEEKLY = 'Biweekly',
  MONTHLY = 'Monthly'
}

export enum Fortnight {
  FIRST = 'FIRST',
  SECOND = 'SECOND'
}

export type Income = {
  __typename?: 'Income';
  comment?: Maybe<Scalars['String']['output']>;
  createdAt?: Maybe<Scalars['Date']['output']>;
  id: Scalars['ID']['output'];
  paymentDate: PaymentDate;
  total: Scalars['Float']['output'];
  updatedAt?: Maybe<Scalars['Date']['output']>;
  userId: Scalars['String']['output'];
};

export type IncomesList = {
  __typename?: 'IncomesList';
  incomes: Array<Income>;
  total: Scalars['Float']['output'];
  totalByMonth: Array<TotalByMonth>;
};

export type IncomesListAndExpenses = {
  __typename?: 'IncomesListAndExpenses';
  expenses?: Maybe<Array<Expense>>;
  expensesTotal?: Maybe<Scalars['Float']['output']>;
  incomes?: Maybe<Array<Income>>;
  incomesTotal: Scalars['Float']['output'];
  remaining?: Maybe<Scalars['Float']['output']>;
};

export type Mutation = {
  __typename?: 'Mutation';
  createCard?: Maybe<Card>;
  createExpense?: Maybe<Expense>;
  createFixedExpense?: Maybe<Array<Maybe<Expense>>>;
  createIncome: Income;
  deleteCard: Scalars['Boolean']['output'];
  deleteExpense: Scalars['Boolean']['output'];
  deleteIncomeById: Scalars['Boolean']['output'];
  updateCard: Card;
  updateExpense: Expense;
  updateIncome?: Maybe<Income>;
};


export type MutationCreateCardArgs = {
  input?: InputMaybe<CreateCardInput>;
};


export type MutationCreateExpenseArgs = {
  input: CreateExpenseInput;
};


export type MutationCreateFixedExpenseArgs = {
  input?: InputMaybe<CreateFixedExpenseInput>;
};


export type MutationCreateIncomeArgs = {
  input: CreateIncomeInput;
};


export type MutationDeleteCardArgs = {
  id: Scalars['ID']['input'];
};


export type MutationDeleteExpenseArgs = {
  id: Scalars['ID']['input'];
};


export type MutationDeleteIncomeByIdArgs = {
  id: Scalars['ID']['input'];
};


export type MutationUpdateCardArgs = {
  input?: InputMaybe<UpdateCardInput>;
};


export type MutationUpdateExpenseArgs = {
  input: UpdateExpenseInput;
};


export type MutationUpdateIncomeArgs = {
  input?: InputMaybe<UpdateIncomeInput>;
};

export type PayBeforeInput = {
  cardId?: InputMaybe<Scalars['ID']['input']>;
  payBefore: Scalars['Date']['input'];
};

export type PaymentDate = {
  __typename?: 'PaymentDate';
  date: Scalars['Date']['output'];
  fortnight: Fortnight;
};

export type Query = {
  __typename?: 'Query';
  allExpenses?: Maybe<Array<Maybe<Expense>>>;
  allExpensesByDateRange?: Maybe<Array<Maybe<Expense>>>;
  cardById?: Maybe<Card>;
  cardList?: Maybe<Array<Maybe<Card>>>;
  expenseById?: Maybe<Expense>;
  expensesByFortnight?: Maybe<ExpensesBy>;
  expensesByMonth?: Maybe<ExpensesBy>;
  expensesTotalByCardId?: Maybe<TotalByCardId>;
  financialBalanceByFortnight?: Maybe<FinancialBalance>;
  incomeById?: Maybe<Income>;
  incomesAndExpensesByFortnight: IncomesListAndExpenses;
  incomesByMonth?: Maybe<Array<Maybe<Income>>>;
  incomesList?: Maybe<IncomesList>;
};


export type QueryAllExpensesByDateRangeArgs = {
  input?: InputMaybe<AllExpensesByDateRangeInput>;
};


export type QueryCardByIdArgs = {
  cardId: Scalars['ID']['input'];
};


export type QueryExpenseByIdArgs = {
  id: Scalars['ID']['input'];
};


export type QueryExpensesByFortnightArgs = {
  input: PayBeforeInput;
};


export type QueryExpensesByMonthArgs = {
  input: PayBeforeInput;
};


export type QueryExpensesTotalByCardIdArgs = {
  cardId: Scalars['ID']['input'];
};


export type QueryFinancialBalanceByFortnightArgs = {
  input: PayBeforeInput;
};


export type QueryIncomeByIdArgs = {
  incomeId: Scalars['ID']['input'];
};


export type QueryIncomesAndExpensesByFortnightArgs = {
  input: PayBeforeInput;
};


export type QueryIncomesByMonthArgs = {
  date: Scalars['Date']['input'];
};

export type Total = {
  date: Scalars['String']['output'];
  month: Scalars['String']['output'];
  total: Scalars['Float']['output'];
  year: Scalars['String']['output'];
};

export type TotalByCardId = {
  __typename?: 'TotalByCardId';
  totalByFortnight?: Maybe<Array<Maybe<TotalByFortnight>>>;
  totalByMonth?: Maybe<Array<Maybe<TotalByMonth>>>;
};

export type TotalByFortnight = Total & {
  __typename?: 'TotalByFortnight';
  date: Scalars['String']['output'];
  fortnight: Fortnight;
  month: Scalars['String']['output'];
  total: Scalars['Float']['output'];
  year: Scalars['String']['output'];
};

export type TotalByMonth = Total & {
  __typename?: 'TotalByMonth';
  date: Scalars['String']['output'];
  month: Scalars['String']['output'];
  total: Scalars['Float']['output'];
  year: Scalars['String']['output'];
};

export type UpdateCardInput = {
  alias?: InputMaybe<Scalars['String']['input']>;
  bank: Scalars['String']['input'];
  id: Scalars['ID']['input'];
  isDebit?: InputMaybe<Scalars['Boolean']['input']>;
  isDigital?: InputMaybe<Scalars['Boolean']['input']>;
};

export type UpdateExpenseInput = {
  cardId?: InputMaybe<Scalars['ID']['input']>;
  category: Category;
  comment?: InputMaybe<Scalars['String']['input']>;
  concept: Scalars['String']['input'];
  id: Scalars['ID']['input'];
  payBefore: Scalars['Date']['input'];
  total: Scalars['Float']['input'];
};

export type UpdateIncomeInput = {
  comment?: InputMaybe<Scalars['String']['input']>;
  incomeId: Scalars['ID']['input'];
  paymentDate: Scalars['Date']['input'];
  total: Scalars['Float']['input'];
};

export type EndDate = {
  day?: InputMaybe<Scalars['Int']['input']>;
  month?: InputMaybe<Scalars['Int']['input']>;
  year?: InputMaybe<Scalars['Int']['input']>;
};

export type InitialDate = {
  day?: InputMaybe<Scalars['Int']['input']>;
  month?: InputMaybe<Scalars['Int']['input']>;
  year?: InputMaybe<Scalars['Int']['input']>;
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


/** Mapping of interface types */
export type ResolversInterfaceTypes<RefType extends Record<string, unknown>> = ResolversObject<{
  Total: ( TotalByFortnight ) | ( TotalByMonth );
}>;

/** Mapping between all available schema types and the resolvers types */
export type ResolversTypes = ResolversObject<{
  AllExpensesByDateRangeInput: AllExpensesByDateRangeInput;
  Boolean: ResolverTypeWrapper<Scalars['Boolean']['output']>;
  Card: ResolverTypeWrapper<Card>;
  Category: Category;
  CreateCardInput: CreateCardInput;
  CreateExpenseInput: CreateExpenseInput;
  CreateFixedExpenseInput: CreateFixedExpenseInput;
  CreateIncomeInput: CreateIncomeInput;
  Date: ResolverTypeWrapper<Scalars['Date']['output']>;
  Expense: ResolverTypeWrapper<Expense>;
  ExpensesBy: ResolverTypeWrapper<ExpensesBy>;
  FinancialBalance: ResolverTypeWrapper<FinancialBalance>;
  FixedExpenseFrequency: FixedExpenseFrequency;
  Float: ResolverTypeWrapper<Scalars['Float']['output']>;
  Fortnight: Fortnight;
  ID: ResolverTypeWrapper<Scalars['ID']['output']>;
  Income: ResolverTypeWrapper<Income>;
  IncomesList: ResolverTypeWrapper<IncomesList>;
  IncomesListAndExpenses: ResolverTypeWrapper<IncomesListAndExpenses>;
  Int: ResolverTypeWrapper<Scalars['Int']['output']>;
  Mutation: ResolverTypeWrapper<{}>;
  PayBeforeInput: PayBeforeInput;
  PaymentDate: ResolverTypeWrapper<PaymentDate>;
  Query: ResolverTypeWrapper<{}>;
  String: ResolverTypeWrapper<Scalars['String']['output']>;
  Total: ResolverTypeWrapper<ResolversInterfaceTypes<ResolversTypes>['Total']>;
  TotalByCardId: ResolverTypeWrapper<TotalByCardId>;
  TotalByFortnight: ResolverTypeWrapper<TotalByFortnight>;
  TotalByMonth: ResolverTypeWrapper<TotalByMonth>;
  UpdateCardInput: UpdateCardInput;
  UpdateExpenseInput: UpdateExpenseInput;
  UpdateIncomeInput: UpdateIncomeInput;
  endDate: EndDate;
  initialDate: InitialDate;
}>;

/** Mapping between all available schema types and the resolvers parents */
export type ResolversParentTypes = ResolversObject<{
  AllExpensesByDateRangeInput: AllExpensesByDateRangeInput;
  Boolean: Scalars['Boolean']['output'];
  Card: Card;
  CreateCardInput: CreateCardInput;
  CreateExpenseInput: CreateExpenseInput;
  CreateFixedExpenseInput: CreateFixedExpenseInput;
  CreateIncomeInput: CreateIncomeInput;
  Date: Scalars['Date']['output'];
  Expense: Expense;
  ExpensesBy: ExpensesBy;
  FinancialBalance: FinancialBalance;
  Float: Scalars['Float']['output'];
  ID: Scalars['ID']['output'];
  Income: Income;
  IncomesList: IncomesList;
  IncomesListAndExpenses: IncomesListAndExpenses;
  Int: Scalars['Int']['output'];
  Mutation: {};
  PayBeforeInput: PayBeforeInput;
  PaymentDate: PaymentDate;
  Query: {};
  String: Scalars['String']['output'];
  Total: ResolversInterfaceTypes<ResolversParentTypes>['Total'];
  TotalByCardId: TotalByCardId;
  TotalByFortnight: TotalByFortnight;
  TotalByMonth: TotalByMonth;
  UpdateCardInput: UpdateCardInput;
  UpdateExpenseInput: UpdateExpenseInput;
  UpdateIncomeInput: UpdateIncomeInput;
  endDate: EndDate;
  initialDate: InitialDate;
}>;

export type CardResolvers<ContextType = Context, ParentType extends ResolversParentTypes['Card'] = ResolversParentTypes['Card']> = ResolversObject<{
  alias?: Resolver<Maybe<ResolversTypes['String']>, ParentType, ContextType>;
  bank?: Resolver<ResolversTypes['String'], ParentType, ContextType>;
  id?: Resolver<ResolversTypes['ID'], ParentType, ContextType>;
  isDebit?: Resolver<Maybe<ResolversTypes['Boolean']>, ParentType, ContextType>;
  isDigital?: Resolver<Maybe<ResolversTypes['Boolean']>, ParentType, ContextType>;
  userId?: Resolver<ResolversTypes['ID'], ParentType, ContextType>;
  __isTypeOf?: IsTypeOfResolverFn<ParentType, ContextType>;
}>;

export interface DateScalarConfig extends GraphQLScalarTypeConfig<ResolversTypes['Date'], any> {
  name: 'Date';
}

export type ExpenseResolvers<ContextType = Context, ParentType extends ResolversParentTypes['Expense'] = ResolversParentTypes['Expense']> = ResolversObject<{
  card?: Resolver<Maybe<ResolversTypes['Card']>, ParentType, ContextType>;
  category?: Resolver<ResolversTypes['Category'], ParentType, ContextType>;
  comment?: Resolver<Maybe<ResolversTypes['String']>, ParentType, ContextType>;
  concept?: Resolver<ResolversTypes['String'], ParentType, ContextType>;
  createdAt?: Resolver<Maybe<ResolversTypes['Date']>, ParentType, ContextType>;
  id?: Resolver<ResolversTypes['ID'], ParentType, ContextType>;
  payBefore?: Resolver<ResolversTypes['Date'], ParentType, ContextType>;
  total?: Resolver<ResolversTypes['Float'], ParentType, ContextType>;
  updatedAt?: Resolver<Maybe<ResolversTypes['Date']>, ParentType, ContextType>;
  userId?: Resolver<Maybe<ResolversTypes['String']>, ParentType, ContextType>;
  __isTypeOf?: IsTypeOfResolverFn<ParentType, ContextType>;
}>;

export type ExpensesByResolvers<ContextType = Context, ParentType extends ResolversParentTypes['ExpensesBy'] = ResolversParentTypes['ExpensesBy']> = ResolversObject<{
  expenses?: Resolver<Maybe<Array<Maybe<ResolversTypes['Expense']>>>, ParentType, ContextType>;
  expensesTotal?: Resolver<Maybe<ResolversTypes['Float']>, ParentType, ContextType>;
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
  updatedAt?: Resolver<Maybe<ResolversTypes['Date']>, ParentType, ContextType>;
  userId?: Resolver<ResolversTypes['String'], ParentType, ContextType>;
  __isTypeOf?: IsTypeOfResolverFn<ParentType, ContextType>;
}>;

export type IncomesListResolvers<ContextType = Context, ParentType extends ResolversParentTypes['IncomesList'] = ResolversParentTypes['IncomesList']> = ResolversObject<{
  incomes?: Resolver<Array<ResolversTypes['Income']>, ParentType, ContextType>;
  total?: Resolver<ResolversTypes['Float'], ParentType, ContextType>;
  totalByMonth?: Resolver<Array<ResolversTypes['TotalByMonth']>, ParentType, ContextType>;
  __isTypeOf?: IsTypeOfResolverFn<ParentType, ContextType>;
}>;

export type IncomesListAndExpensesResolvers<ContextType = Context, ParentType extends ResolversParentTypes['IncomesListAndExpenses'] = ResolversParentTypes['IncomesListAndExpenses']> = ResolversObject<{
  expenses?: Resolver<Maybe<Array<ResolversTypes['Expense']>>, ParentType, ContextType>;
  expensesTotal?: Resolver<Maybe<ResolversTypes['Float']>, ParentType, ContextType>;
  incomes?: Resolver<Maybe<Array<ResolversTypes['Income']>>, ParentType, ContextType>;
  incomesTotal?: Resolver<ResolversTypes['Float'], ParentType, ContextType>;
  remaining?: Resolver<Maybe<ResolversTypes['Float']>, ParentType, ContextType>;
  __isTypeOf?: IsTypeOfResolverFn<ParentType, ContextType>;
}>;

export type MutationResolvers<ContextType = Context, ParentType extends ResolversParentTypes['Mutation'] = ResolversParentTypes['Mutation']> = ResolversObject<{
  createCard?: Resolver<Maybe<ResolversTypes['Card']>, ParentType, ContextType, Partial<MutationCreateCardArgs>>;
  createExpense?: Resolver<Maybe<ResolversTypes['Expense']>, ParentType, ContextType, RequireFields<MutationCreateExpenseArgs, 'input'>>;
  createFixedExpense?: Resolver<Maybe<Array<Maybe<ResolversTypes['Expense']>>>, ParentType, ContextType, Partial<MutationCreateFixedExpenseArgs>>;
  createIncome?: Resolver<ResolversTypes['Income'], ParentType, ContextType, RequireFields<MutationCreateIncomeArgs, 'input'>>;
  deleteCard?: Resolver<ResolversTypes['Boolean'], ParentType, ContextType, RequireFields<MutationDeleteCardArgs, 'id'>>;
  deleteExpense?: Resolver<ResolversTypes['Boolean'], ParentType, ContextType, RequireFields<MutationDeleteExpenseArgs, 'id'>>;
  deleteIncomeById?: Resolver<ResolversTypes['Boolean'], ParentType, ContextType, RequireFields<MutationDeleteIncomeByIdArgs, 'id'>>;
  updateCard?: Resolver<ResolversTypes['Card'], ParentType, ContextType, Partial<MutationUpdateCardArgs>>;
  updateExpense?: Resolver<ResolversTypes['Expense'], ParentType, ContextType, RequireFields<MutationUpdateExpenseArgs, 'input'>>;
  updateIncome?: Resolver<Maybe<ResolversTypes['Income']>, ParentType, ContextType, Partial<MutationUpdateIncomeArgs>>;
}>;

export type PaymentDateResolvers<ContextType = Context, ParentType extends ResolversParentTypes['PaymentDate'] = ResolversParentTypes['PaymentDate']> = ResolversObject<{
  date?: Resolver<ResolversTypes['Date'], ParentType, ContextType>;
  fortnight?: Resolver<ResolversTypes['Fortnight'], ParentType, ContextType>;
  __isTypeOf?: IsTypeOfResolverFn<ParentType, ContextType>;
}>;

export type QueryResolvers<ContextType = Context, ParentType extends ResolversParentTypes['Query'] = ResolversParentTypes['Query']> = ResolversObject<{
  allExpenses?: Resolver<Maybe<Array<Maybe<ResolversTypes['Expense']>>>, ParentType, ContextType>;
  allExpensesByDateRange?: Resolver<Maybe<Array<Maybe<ResolversTypes['Expense']>>>, ParentType, ContextType, Partial<QueryAllExpensesByDateRangeArgs>>;
  cardById?: Resolver<Maybe<ResolversTypes['Card']>, ParentType, ContextType, RequireFields<QueryCardByIdArgs, 'cardId'>>;
  cardList?: Resolver<Maybe<Array<Maybe<ResolversTypes['Card']>>>, ParentType, ContextType>;
  expenseById?: Resolver<Maybe<ResolversTypes['Expense']>, ParentType, ContextType, RequireFields<QueryExpenseByIdArgs, 'id'>>;
  expensesByFortnight?: Resolver<Maybe<ResolversTypes['ExpensesBy']>, ParentType, ContextType, RequireFields<QueryExpensesByFortnightArgs, 'input'>>;
  expensesByMonth?: Resolver<Maybe<ResolversTypes['ExpensesBy']>, ParentType, ContextType, RequireFields<QueryExpensesByMonthArgs, 'input'>>;
  expensesTotalByCardId?: Resolver<Maybe<ResolversTypes['TotalByCardId']>, ParentType, ContextType, RequireFields<QueryExpensesTotalByCardIdArgs, 'cardId'>>;
  financialBalanceByFortnight?: Resolver<Maybe<ResolversTypes['FinancialBalance']>, ParentType, ContextType, RequireFields<QueryFinancialBalanceByFortnightArgs, 'input'>>;
  incomeById?: Resolver<Maybe<ResolversTypes['Income']>, ParentType, ContextType, RequireFields<QueryIncomeByIdArgs, 'incomeId'>>;
  incomesAndExpensesByFortnight?: Resolver<ResolversTypes['IncomesListAndExpenses'], ParentType, ContextType, RequireFields<QueryIncomesAndExpensesByFortnightArgs, 'input'>>;
  incomesByMonth?: Resolver<Maybe<Array<Maybe<ResolversTypes['Income']>>>, ParentType, ContextType, RequireFields<QueryIncomesByMonthArgs, 'date'>>;
  incomesList?: Resolver<Maybe<ResolversTypes['IncomesList']>, ParentType, ContextType>;
}>;

export type TotalResolvers<ContextType = Context, ParentType extends ResolversParentTypes['Total'] = ResolversParentTypes['Total']> = ResolversObject<{
  __resolveType: TypeResolveFn<'TotalByFortnight' | 'TotalByMonth', ParentType, ContextType>;
  date?: Resolver<ResolversTypes['String'], ParentType, ContextType>;
  month?: Resolver<ResolversTypes['String'], ParentType, ContextType>;
  total?: Resolver<ResolversTypes['Float'], ParentType, ContextType>;
  year?: Resolver<ResolversTypes['String'], ParentType, ContextType>;
}>;

export type TotalByCardIdResolvers<ContextType = Context, ParentType extends ResolversParentTypes['TotalByCardId'] = ResolversParentTypes['TotalByCardId']> = ResolversObject<{
  totalByFortnight?: Resolver<Maybe<Array<Maybe<ResolversTypes['TotalByFortnight']>>>, ParentType, ContextType>;
  totalByMonth?: Resolver<Maybe<Array<Maybe<ResolversTypes['TotalByMonth']>>>, ParentType, ContextType>;
  __isTypeOf?: IsTypeOfResolverFn<ParentType, ContextType>;
}>;

export type TotalByFortnightResolvers<ContextType = Context, ParentType extends ResolversParentTypes['TotalByFortnight'] = ResolversParentTypes['TotalByFortnight']> = ResolversObject<{
  date?: Resolver<ResolversTypes['String'], ParentType, ContextType>;
  fortnight?: Resolver<ResolversTypes['Fortnight'], ParentType, ContextType>;
  month?: Resolver<ResolversTypes['String'], ParentType, ContextType>;
  total?: Resolver<ResolversTypes['Float'], ParentType, ContextType>;
  year?: Resolver<ResolversTypes['String'], ParentType, ContextType>;
  __isTypeOf?: IsTypeOfResolverFn<ParentType, ContextType>;
}>;

export type TotalByMonthResolvers<ContextType = Context, ParentType extends ResolversParentTypes['TotalByMonth'] = ResolversParentTypes['TotalByMonth']> = ResolversObject<{
  date?: Resolver<ResolversTypes['String'], ParentType, ContextType>;
  month?: Resolver<ResolversTypes['String'], ParentType, ContextType>;
  total?: Resolver<ResolversTypes['Float'], ParentType, ContextType>;
  year?: Resolver<ResolversTypes['String'], ParentType, ContextType>;
  __isTypeOf?: IsTypeOfResolverFn<ParentType, ContextType>;
}>;

export type Resolvers<ContextType = Context> = ResolversObject<{
  Card?: CardResolvers<ContextType>;
  Date?: GraphQLScalarType;
  Expense?: ExpenseResolvers<ContextType>;
  ExpensesBy?: ExpensesByResolvers<ContextType>;
  FinancialBalance?: FinancialBalanceResolvers<ContextType>;
  Income?: IncomeResolvers<ContextType>;
  IncomesList?: IncomesListResolvers<ContextType>;
  IncomesListAndExpenses?: IncomesListAndExpensesResolvers<ContextType>;
  Mutation?: MutationResolvers<ContextType>;
  PaymentDate?: PaymentDateResolvers<ContextType>;
  Query?: QueryResolvers<ContextType>;
  Total?: TotalResolvers<ContextType>;
  TotalByCardId?: TotalByCardIdResolvers<ContextType>;
  TotalByFortnight?: TotalByFortnightResolvers<ContextType>;
  TotalByMonth?: TotalByMonthResolvers<ContextType>;
}>;

