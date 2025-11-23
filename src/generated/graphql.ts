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

export enum Auth_Status {
  AUTHENTICATED = 'AUTHENTICATED',
  UNAUTHENTICATED = 'UNAUTHENTICATED'
}

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

export type Categories = {
  __typename?: 'Categories';
  id?: Maybe<Scalars['ID']['output']>;
  name?: Maybe<Scalars['String']['output']>;
  subCategory?: Maybe<Array<SubCategory>>;
  userId?: Maybe<Scalars['ID']['output']>;
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

export type CategoryAllocation = {
  __typename?: 'CategoryAllocation';
  categorySum?: Maybe<Array<Maybe<CategorySum>>>;
  expenses?: Maybe<Array<Maybe<Expense>>>;
  income?: Maybe<Income>;
};

export type CategoryAllocationInput = {
  incomeId: Scalars['String']['input'];
  periodId: Scalars['String']['input'];
};

export type CategorySetting = {
  __typename?: 'CategorySetting';
  id: Scalars['ID']['output'];
  message: Scalars['String']['output'];
};

export type CategorySettings = {
  __typename?: 'CategorySettings';
  percentageTotal: Scalars['Float']['output'];
  settings?: Maybe<Array<CategoryType>>;
};

export type CategorySum = {
  __typename?: 'CategorySum';
  allocated: Scalars['String']['output'];
  category: CategoryType;
  id: Scalars['ID']['output'];
  remaining: Scalars['String']['output'];
  sum: Scalars['String']['output'];
};

export type CategoryType = {
  __typename?: 'CategoryType';
  id: Scalars['ID']['output'];
  name: Scalars['String']['output'];
  percentage?: Maybe<Scalars['Float']['output']>;
  userId?: Maybe<Scalars['ID']['output']>;
};

export type CreateCardInput = {
  alias?: InputMaybe<Scalars['String']['input']>;
  bank: Scalars['String']['input'];
  isDebit?: InputMaybe<Scalars['Boolean']['input']>;
  isDigital?: InputMaybe<Scalars['Boolean']['input']>;
};

export type CreateCategorySettingInput = {
  allocationPercentage: Scalars['Float']['input'];
  categoryId: Scalars['ID']['input'];
};

export type CreateExpenseInput = {
  cardId?: InputMaybe<Scalars['ID']['input']>;
  categoryId: Scalars['String']['input'];
  comment?: InputMaybe<Scalars['String']['input']>;
  concept: Scalars['String']['input'];
  payBefore: Scalars['Date']['input'];
  periodId: Scalars['String']['input'];
  subCategoryId: Scalars['String']['input'];
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
  category: CategoryType;
  comment?: Maybe<Scalars['String']['output']>;
  concept: Scalars['String']['output'];
  createdAt?: Maybe<Scalars['String']['output']>;
  id: Scalars['ID']['output'];
  payBefore: Scalars['String']['output'];
  periodId?: Maybe<Scalars['String']['output']>;
  subCategory: SubCategory;
  total: Scalars['String']['output'];
  updatedAt?: Maybe<Scalars['Date']['output']>;
  userId?: Maybe<Scalars['String']['output']>;
};

export type ExpensesBy = {
  __typename?: 'ExpensesBy';
  expenses?: Maybe<Array<Maybe<Expense>>>;
  expensesTotal?: Maybe<Scalars['Float']['output']>;
};

export type FilterInput = {
  cardId?: InputMaybe<Scalars['ID']['input']>;
  endDate?: InputMaybe<Scalars['Date']['input']>;
  month?: InputMaybe<Scalars['String']['input']>;
  periodId?: InputMaybe<Scalars['ID']['input']>;
  startDate?: InputMaybe<Scalars['Date']['input']>;
  subCategoryIds?: InputMaybe<Array<Scalars['ID']['input']>>;
  year?: InputMaybe<Scalars['String']['input']>;
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

export type GroupedExpenses = {
  __typename?: 'GroupedExpenses';
  date: Scalars['String']['output'];
  expenses?: Maybe<Array<Expense>>;
  total: Scalars['String']['output'];
};

export type Income = {
  __typename?: 'Income';
  comment?: Maybe<Scalars['String']['output']>;
  createdAt?: Maybe<Scalars['Date']['output']>;
  id: Scalars['ID']['output'];
  paymentDate: PaymentDate;
  period?: Maybe<Period>;
  total: Scalars['String']['output'];
  updatedAt?: Maybe<Scalars['Date']['output']>;
  userId: Scalars['String']['output'];
};

export type IncomesGroupedBy = {
  __typename?: 'IncomesGroupedBy';
  incomes: Array<Income>;
  month: Scalars['String']['output'];
  total: Scalars['String']['output'];
  year: Scalars['String']['output'];
};

export type IncomesList = {
  __typename?: 'IncomesList';
  incomes: Array<Income>;
  total: Scalars['Float']['output'];
  totalByMonth: Array<TotalByMonth>;
};

export type IncomesListAndExpenses = {
  __typename?: 'IncomesListAndExpenses';
  expensesTotal?: Maybe<Scalars['String']['output']>;
  groupedExpenses?: Maybe<Array<GroupedExpenses>>;
  incomes?: Maybe<Array<Income>>;
  incomesTotal: Scalars['String']['output'];
  remaining?: Maybe<Scalars['String']['output']>;
};

export type InvestmentRecord = {
  __typename?: 'InvestmentRecord';
  amount: Scalars['String']['output'];
  id: Scalars['ID']['output'];
  purchasedOn: Scalars['String']['output'];
  udiAmount: Scalars['Float']['output'];
  udiValue: Scalars['String']['output'];
  userId: Scalars['ID']['output'];
};

export type LoginResponse = {
  __typename?: 'LoginResponse';
  status: Auth_Status;
};

export type Mutation = {
  __typename?: 'Mutation';
  createCard?: Maybe<Card>;
  createCategorySetting: CategorySetting;
  createExpense?: Maybe<Expense>;
  createFixedExpense?: Maybe<Array<Maybe<Expense>>>;
  createIncome: Income;
  deleteCard: Scalars['Boolean']['output'];
  deleteCategorySetting: CategorySetting;
  deleteExpense: Scalars['Boolean']['output'];
  deleteIncomeById: Scalars['Boolean']['output'];
  updateCard: Card;
  updateCategoryAllocation: CategorySetting;
  updateCategorySetting: CategorySettings;
  updateExpense: Expense;
  updateIncome?: Maybe<Income>;
};


export type MutationCreateCardArgs = {
  input?: InputMaybe<CreateCardInput>;
};


export type MutationCreateCategorySettingArgs = {
  input: CreateCategorySettingInput;
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


export type MutationDeleteCategorySettingArgs = {
  categoryId: Scalars['ID']['input'];
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


export type MutationUpdateCategoryAllocationArgs = {
  input?: InputMaybe<UpdateCategoryAllocationInput>;
};


export type MutationUpdateCategorySettingArgs = {
  input: UpdateCategorySettingInput;
};


export type MutationUpdateExpenseArgs = {
  input: UpdateExpenseInput;
};


export type MutationUpdateIncomeArgs = {
  input?: InputMaybe<UpdateIncomeInput>;
};

export type PayBeforeInput = {
  cardId?: InputMaybe<Scalars['ID']['input']>;
  payBefore?: InputMaybe<Scalars['Date']['input']>;
  periodId?: InputMaybe<Scalars['String']['input']>;
};

export type PaymentDate = {
  __typename?: 'PaymentDate';
  date: Scalars['String']['output'];
  fortnight: Fortnight;
};

export type Period = {
  __typename?: 'Period';
  createdAt?: Maybe<Scalars['String']['output']>;
  endDate: Scalars['String']['output'];
  id: Scalars['ID']['output'];
  startDate: Scalars['String']['output'];
  updatedAt?: Maybe<Scalars['String']['output']>;
  userId: Scalars['String']['output'];
};

export type Query = {
  __typename?: 'Query';
  allExpenses?: Maybe<Array<Maybe<Expense>>>;
  allInvestmentRecords?: Maybe<Array<InvestmentRecord>>;
  cardById?: Maybe<Card>;
  cardList?: Maybe<Array<Maybe<Card>>>;
  categoryAllocation?: Maybe<CategoryAllocation>;
  categoryList?: Maybe<Array<Categories>>;
  categorySettings?: Maybe<CategorySettings>;
  expenseById?: Maybe<Expense>;
  financialBalanceByFortnight?: Maybe<FinancialBalance>;
  incomeById?: Maybe<Income>;
  incomesGroupedBy?: Maybe<Array<IncomesGroupedBy>>;
  incomesList?: Maybe<IncomesList>;
  incomesWithExpenses: IncomesListAndExpenses;
  login: LoginResponse;
  period?: Maybe<Period>;
  periodsList?: Maybe<Array<Period>>;
  udiValue: UdiValue;
};


export type QueryCardByIdArgs = {
  cardId: Scalars['ID']['input'];
};


export type QueryCategoryAllocationArgs = {
  input: CategoryAllocationInput;
};


export type QueryExpenseByIdArgs = {
  id: Scalars['ID']['input'];
};


export type QueryFinancialBalanceByFortnightArgs = {
  input: PayBeforeInput;
};


export type QueryIncomeByIdArgs = {
  incomeId: Scalars['ID']['input'];
};


export type QueryIncomesWithExpensesArgs = {
  input: FilterInput;
};


export type QueryPeriodArgs = {
  input: FilterInput;
};

export type SubCategory = {
  __typename?: 'SubCategory';
  id: Scalars['ID']['output'];
  name: Scalars['String']['output'];
  userId?: Maybe<Scalars['ID']['output']>;
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

export type UdiValue = {
  __typename?: 'UdiValue';
  amount?: Maybe<Scalars['String']['output']>;
  date?: Maybe<Scalars['String']['output']>;
};

export type UpdateCardInput = {
  alias?: InputMaybe<Scalars['String']['input']>;
  bank: Scalars['String']['input'];
  id: Scalars['ID']['input'];
  isDebit?: InputMaybe<Scalars['Boolean']['input']>;
  isDigital?: InputMaybe<Scalars['Boolean']['input']>;
};

export type UpdateCategoryAllocationInput = {
  id: Scalars['ID']['input'];
  incomeId: Scalars['ID']['input'];
  percentage: Scalars['Float']['input'];
};

export type UpdateCategorySettingInput = {
  id: Scalars['ID']['input'];
  percentage: Scalars['Float']['input'];
};

export type UpdateExpenseInput = {
  cardId?: InputMaybe<Scalars['ID']['input']>;
  comment?: InputMaybe<Scalars['String']['input']>;
  concept: Scalars['String']['input'];
  id: Scalars['ID']['input'];
  payBefore: Scalars['Date']['input'];
  subCategoryId: Scalars['String']['input'];
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
  AUTH_STATUS: Auth_Status;
  AllExpensesByDateRangeInput: AllExpensesByDateRangeInput;
  Boolean: ResolverTypeWrapper<Scalars['Boolean']['output']>;
  Card: ResolverTypeWrapper<Card>;
  Categories: ResolverTypeWrapper<Categories>;
  Category: Category;
  CategoryAllocation: ResolverTypeWrapper<CategoryAllocation>;
  CategoryAllocationInput: CategoryAllocationInput;
  CategorySetting: ResolverTypeWrapper<CategorySetting>;
  CategorySettings: ResolverTypeWrapper<CategorySettings>;
  CategorySum: ResolverTypeWrapper<CategorySum>;
  CategoryType: ResolverTypeWrapper<CategoryType>;
  CreateCardInput: CreateCardInput;
  CreateCategorySettingInput: CreateCategorySettingInput;
  CreateExpenseInput: CreateExpenseInput;
  CreateFixedExpenseInput: CreateFixedExpenseInput;
  CreateIncomeInput: CreateIncomeInput;
  Date: ResolverTypeWrapper<Scalars['Date']['output']>;
  Expense: ResolverTypeWrapper<Expense>;
  ExpensesBy: ResolverTypeWrapper<ExpensesBy>;
  FilterInput: FilterInput;
  FinancialBalance: ResolverTypeWrapper<FinancialBalance>;
  FixedExpenseFrequency: FixedExpenseFrequency;
  Float: ResolverTypeWrapper<Scalars['Float']['output']>;
  Fortnight: Fortnight;
  GroupedExpenses: ResolverTypeWrapper<GroupedExpenses>;
  ID: ResolverTypeWrapper<Scalars['ID']['output']>;
  Income: ResolverTypeWrapper<Income>;
  IncomesGroupedBy: ResolverTypeWrapper<IncomesGroupedBy>;
  IncomesList: ResolverTypeWrapper<IncomesList>;
  IncomesListAndExpenses: ResolverTypeWrapper<IncomesListAndExpenses>;
  Int: ResolverTypeWrapper<Scalars['Int']['output']>;
  InvestmentRecord: ResolverTypeWrapper<InvestmentRecord>;
  LoginResponse: ResolverTypeWrapper<LoginResponse>;
  Mutation: ResolverTypeWrapper<{}>;
  PayBeforeInput: PayBeforeInput;
  PaymentDate: ResolverTypeWrapper<PaymentDate>;
  Period: ResolverTypeWrapper<Period>;
  Query: ResolverTypeWrapper<{}>;
  String: ResolverTypeWrapper<Scalars['String']['output']>;
  SubCategory: ResolverTypeWrapper<SubCategory>;
  Total: ResolverTypeWrapper<ResolversInterfaceTypes<ResolversTypes>['Total']>;
  TotalByCardId: ResolverTypeWrapper<TotalByCardId>;
  TotalByFortnight: ResolverTypeWrapper<TotalByFortnight>;
  TotalByMonth: ResolverTypeWrapper<TotalByMonth>;
  UdiValue: ResolverTypeWrapper<UdiValue>;
  UpdateCardInput: UpdateCardInput;
  UpdateCategoryAllocationInput: UpdateCategoryAllocationInput;
  UpdateCategorySettingInput: UpdateCategorySettingInput;
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
  Categories: Categories;
  CategoryAllocation: CategoryAllocation;
  CategoryAllocationInput: CategoryAllocationInput;
  CategorySetting: CategorySetting;
  CategorySettings: CategorySettings;
  CategorySum: CategorySum;
  CategoryType: CategoryType;
  CreateCardInput: CreateCardInput;
  CreateCategorySettingInput: CreateCategorySettingInput;
  CreateExpenseInput: CreateExpenseInput;
  CreateFixedExpenseInput: CreateFixedExpenseInput;
  CreateIncomeInput: CreateIncomeInput;
  Date: Scalars['Date']['output'];
  Expense: Expense;
  ExpensesBy: ExpensesBy;
  FilterInput: FilterInput;
  FinancialBalance: FinancialBalance;
  Float: Scalars['Float']['output'];
  GroupedExpenses: GroupedExpenses;
  ID: Scalars['ID']['output'];
  Income: Income;
  IncomesGroupedBy: IncomesGroupedBy;
  IncomesList: IncomesList;
  IncomesListAndExpenses: IncomesListAndExpenses;
  Int: Scalars['Int']['output'];
  InvestmentRecord: InvestmentRecord;
  LoginResponse: LoginResponse;
  Mutation: {};
  PayBeforeInput: PayBeforeInput;
  PaymentDate: PaymentDate;
  Period: Period;
  Query: {};
  String: Scalars['String']['output'];
  SubCategory: SubCategory;
  Total: ResolversInterfaceTypes<ResolversParentTypes>['Total'];
  TotalByCardId: TotalByCardId;
  TotalByFortnight: TotalByFortnight;
  TotalByMonth: TotalByMonth;
  UdiValue: UdiValue;
  UpdateCardInput: UpdateCardInput;
  UpdateCategoryAllocationInput: UpdateCategoryAllocationInput;
  UpdateCategorySettingInput: UpdateCategorySettingInput;
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

export type CategoriesResolvers<ContextType = Context, ParentType extends ResolversParentTypes['Categories'] = ResolversParentTypes['Categories']> = ResolversObject<{
  id?: Resolver<Maybe<ResolversTypes['ID']>, ParentType, ContextType>;
  name?: Resolver<Maybe<ResolversTypes['String']>, ParentType, ContextType>;
  subCategory?: Resolver<Maybe<Array<ResolversTypes['SubCategory']>>, ParentType, ContextType>;
  userId?: Resolver<Maybe<ResolversTypes['ID']>, ParentType, ContextType>;
  __isTypeOf?: IsTypeOfResolverFn<ParentType, ContextType>;
}>;

export type CategoryAllocationResolvers<ContextType = Context, ParentType extends ResolversParentTypes['CategoryAllocation'] = ResolversParentTypes['CategoryAllocation']> = ResolversObject<{
  categorySum?: Resolver<Maybe<Array<Maybe<ResolversTypes['CategorySum']>>>, ParentType, ContextType>;
  expenses?: Resolver<Maybe<Array<Maybe<ResolversTypes['Expense']>>>, ParentType, ContextType>;
  income?: Resolver<Maybe<ResolversTypes['Income']>, ParentType, ContextType>;
  __isTypeOf?: IsTypeOfResolverFn<ParentType, ContextType>;
}>;

export type CategorySettingResolvers<ContextType = Context, ParentType extends ResolversParentTypes['CategorySetting'] = ResolversParentTypes['CategorySetting']> = ResolversObject<{
  id?: Resolver<ResolversTypes['ID'], ParentType, ContextType>;
  message?: Resolver<ResolversTypes['String'], ParentType, ContextType>;
  __isTypeOf?: IsTypeOfResolverFn<ParentType, ContextType>;
}>;

export type CategorySettingsResolvers<ContextType = Context, ParentType extends ResolversParentTypes['CategorySettings'] = ResolversParentTypes['CategorySettings']> = ResolversObject<{
  percentageTotal?: Resolver<ResolversTypes['Float'], ParentType, ContextType>;
  settings?: Resolver<Maybe<Array<ResolversTypes['CategoryType']>>, ParentType, ContextType>;
  __isTypeOf?: IsTypeOfResolverFn<ParentType, ContextType>;
}>;

export type CategorySumResolvers<ContextType = Context, ParentType extends ResolversParentTypes['CategorySum'] = ResolversParentTypes['CategorySum']> = ResolversObject<{
  allocated?: Resolver<ResolversTypes['String'], ParentType, ContextType>;
  category?: Resolver<ResolversTypes['CategoryType'], ParentType, ContextType>;
  id?: Resolver<ResolversTypes['ID'], ParentType, ContextType>;
  remaining?: Resolver<ResolversTypes['String'], ParentType, ContextType>;
  sum?: Resolver<ResolversTypes['String'], ParentType, ContextType>;
  __isTypeOf?: IsTypeOfResolverFn<ParentType, ContextType>;
}>;

export type CategoryTypeResolvers<ContextType = Context, ParentType extends ResolversParentTypes['CategoryType'] = ResolversParentTypes['CategoryType']> = ResolversObject<{
  id?: Resolver<ResolversTypes['ID'], ParentType, ContextType>;
  name?: Resolver<ResolversTypes['String'], ParentType, ContextType>;
  percentage?: Resolver<Maybe<ResolversTypes['Float']>, ParentType, ContextType>;
  userId?: Resolver<Maybe<ResolversTypes['ID']>, ParentType, ContextType>;
  __isTypeOf?: IsTypeOfResolverFn<ParentType, ContextType>;
}>;

export interface DateScalarConfig extends GraphQLScalarTypeConfig<ResolversTypes['Date'], any> {
  name: 'Date';
}

export type ExpenseResolvers<ContextType = Context, ParentType extends ResolversParentTypes['Expense'] = ResolversParentTypes['Expense']> = ResolversObject<{
  card?: Resolver<Maybe<ResolversTypes['Card']>, ParentType, ContextType>;
  category?: Resolver<ResolversTypes['CategoryType'], ParentType, ContextType>;
  comment?: Resolver<Maybe<ResolversTypes['String']>, ParentType, ContextType>;
  concept?: Resolver<ResolversTypes['String'], ParentType, ContextType>;
  createdAt?: Resolver<Maybe<ResolversTypes['String']>, ParentType, ContextType>;
  id?: Resolver<ResolversTypes['ID'], ParentType, ContextType>;
  payBefore?: Resolver<ResolversTypes['String'], ParentType, ContextType>;
  periodId?: Resolver<Maybe<ResolversTypes['String']>, ParentType, ContextType>;
  subCategory?: Resolver<ResolversTypes['SubCategory'], ParentType, ContextType>;
  total?: Resolver<ResolversTypes['String'], ParentType, ContextType>;
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

export type GroupedExpensesResolvers<ContextType = Context, ParentType extends ResolversParentTypes['GroupedExpenses'] = ResolversParentTypes['GroupedExpenses']> = ResolversObject<{
  date?: Resolver<ResolversTypes['String'], ParentType, ContextType>;
  expenses?: Resolver<Maybe<Array<ResolversTypes['Expense']>>, ParentType, ContextType>;
  total?: Resolver<ResolversTypes['String'], ParentType, ContextType>;
  __isTypeOf?: IsTypeOfResolverFn<ParentType, ContextType>;
}>;

export type IncomeResolvers<ContextType = Context, ParentType extends ResolversParentTypes['Income'] = ResolversParentTypes['Income']> = ResolversObject<{
  comment?: Resolver<Maybe<ResolversTypes['String']>, ParentType, ContextType>;
  createdAt?: Resolver<Maybe<ResolversTypes['Date']>, ParentType, ContextType>;
  id?: Resolver<ResolversTypes['ID'], ParentType, ContextType>;
  paymentDate?: Resolver<ResolversTypes['PaymentDate'], ParentType, ContextType>;
  period?: Resolver<Maybe<ResolversTypes['Period']>, ParentType, ContextType>;
  total?: Resolver<ResolversTypes['String'], ParentType, ContextType>;
  updatedAt?: Resolver<Maybe<ResolversTypes['Date']>, ParentType, ContextType>;
  userId?: Resolver<ResolversTypes['String'], ParentType, ContextType>;
  __isTypeOf?: IsTypeOfResolverFn<ParentType, ContextType>;
}>;

export type IncomesGroupedByResolvers<ContextType = Context, ParentType extends ResolversParentTypes['IncomesGroupedBy'] = ResolversParentTypes['IncomesGroupedBy']> = ResolversObject<{
  incomes?: Resolver<Array<ResolversTypes['Income']>, ParentType, ContextType>;
  month?: Resolver<ResolversTypes['String'], ParentType, ContextType>;
  total?: Resolver<ResolversTypes['String'], ParentType, ContextType>;
  year?: Resolver<ResolversTypes['String'], ParentType, ContextType>;
  __isTypeOf?: IsTypeOfResolverFn<ParentType, ContextType>;
}>;

export type IncomesListResolvers<ContextType = Context, ParentType extends ResolversParentTypes['IncomesList'] = ResolversParentTypes['IncomesList']> = ResolversObject<{
  incomes?: Resolver<Array<ResolversTypes['Income']>, ParentType, ContextType>;
  total?: Resolver<ResolversTypes['Float'], ParentType, ContextType>;
  totalByMonth?: Resolver<Array<ResolversTypes['TotalByMonth']>, ParentType, ContextType>;
  __isTypeOf?: IsTypeOfResolverFn<ParentType, ContextType>;
}>;

export type IncomesListAndExpensesResolvers<ContextType = Context, ParentType extends ResolversParentTypes['IncomesListAndExpenses'] = ResolversParentTypes['IncomesListAndExpenses']> = ResolversObject<{
  expensesTotal?: Resolver<Maybe<ResolversTypes['String']>, ParentType, ContextType>;
  groupedExpenses?: Resolver<Maybe<Array<ResolversTypes['GroupedExpenses']>>, ParentType, ContextType>;
  incomes?: Resolver<Maybe<Array<ResolversTypes['Income']>>, ParentType, ContextType>;
  incomesTotal?: Resolver<ResolversTypes['String'], ParentType, ContextType>;
  remaining?: Resolver<Maybe<ResolversTypes['String']>, ParentType, ContextType>;
  __isTypeOf?: IsTypeOfResolverFn<ParentType, ContextType>;
}>;

export type InvestmentRecordResolvers<ContextType = Context, ParentType extends ResolversParentTypes['InvestmentRecord'] = ResolversParentTypes['InvestmentRecord']> = ResolversObject<{
  amount?: Resolver<ResolversTypes['String'], ParentType, ContextType>;
  id?: Resolver<ResolversTypes['ID'], ParentType, ContextType>;
  purchasedOn?: Resolver<ResolversTypes['String'], ParentType, ContextType>;
  udiAmount?: Resolver<ResolversTypes['Float'], ParentType, ContextType>;
  udiValue?: Resolver<ResolversTypes['String'], ParentType, ContextType>;
  userId?: Resolver<ResolversTypes['ID'], ParentType, ContextType>;
  __isTypeOf?: IsTypeOfResolverFn<ParentType, ContextType>;
}>;

export type LoginResponseResolvers<ContextType = Context, ParentType extends ResolversParentTypes['LoginResponse'] = ResolversParentTypes['LoginResponse']> = ResolversObject<{
  status?: Resolver<ResolversTypes['AUTH_STATUS'], ParentType, ContextType>;
  __isTypeOf?: IsTypeOfResolverFn<ParentType, ContextType>;
}>;

export type MutationResolvers<ContextType = Context, ParentType extends ResolversParentTypes['Mutation'] = ResolversParentTypes['Mutation']> = ResolversObject<{
  createCard?: Resolver<Maybe<ResolversTypes['Card']>, ParentType, ContextType, Partial<MutationCreateCardArgs>>;
  createCategorySetting?: Resolver<ResolversTypes['CategorySetting'], ParentType, ContextType, RequireFields<MutationCreateCategorySettingArgs, 'input'>>;
  createExpense?: Resolver<Maybe<ResolversTypes['Expense']>, ParentType, ContextType, RequireFields<MutationCreateExpenseArgs, 'input'>>;
  createFixedExpense?: Resolver<Maybe<Array<Maybe<ResolversTypes['Expense']>>>, ParentType, ContextType, Partial<MutationCreateFixedExpenseArgs>>;
  createIncome?: Resolver<ResolversTypes['Income'], ParentType, ContextType, RequireFields<MutationCreateIncomeArgs, 'input'>>;
  deleteCard?: Resolver<ResolversTypes['Boolean'], ParentType, ContextType, RequireFields<MutationDeleteCardArgs, 'id'>>;
  deleteCategorySetting?: Resolver<ResolversTypes['CategorySetting'], ParentType, ContextType, RequireFields<MutationDeleteCategorySettingArgs, 'categoryId'>>;
  deleteExpense?: Resolver<ResolversTypes['Boolean'], ParentType, ContextType, RequireFields<MutationDeleteExpenseArgs, 'id'>>;
  deleteIncomeById?: Resolver<ResolversTypes['Boolean'], ParentType, ContextType, RequireFields<MutationDeleteIncomeByIdArgs, 'id'>>;
  updateCard?: Resolver<ResolversTypes['Card'], ParentType, ContextType, Partial<MutationUpdateCardArgs>>;
  updateCategoryAllocation?: Resolver<ResolversTypes['CategorySetting'], ParentType, ContextType, Partial<MutationUpdateCategoryAllocationArgs>>;
  updateCategorySetting?: Resolver<ResolversTypes['CategorySettings'], ParentType, ContextType, RequireFields<MutationUpdateCategorySettingArgs, 'input'>>;
  updateExpense?: Resolver<ResolversTypes['Expense'], ParentType, ContextType, RequireFields<MutationUpdateExpenseArgs, 'input'>>;
  updateIncome?: Resolver<Maybe<ResolversTypes['Income']>, ParentType, ContextType, Partial<MutationUpdateIncomeArgs>>;
}>;

export type PaymentDateResolvers<ContextType = Context, ParentType extends ResolversParentTypes['PaymentDate'] = ResolversParentTypes['PaymentDate']> = ResolversObject<{
  date?: Resolver<ResolversTypes['String'], ParentType, ContextType>;
  fortnight?: Resolver<ResolversTypes['Fortnight'], ParentType, ContextType>;
  __isTypeOf?: IsTypeOfResolverFn<ParentType, ContextType>;
}>;

export type PeriodResolvers<ContextType = Context, ParentType extends ResolversParentTypes['Period'] = ResolversParentTypes['Period']> = ResolversObject<{
  createdAt?: Resolver<Maybe<ResolversTypes['String']>, ParentType, ContextType>;
  endDate?: Resolver<ResolversTypes['String'], ParentType, ContextType>;
  id?: Resolver<ResolversTypes['ID'], ParentType, ContextType>;
  startDate?: Resolver<ResolversTypes['String'], ParentType, ContextType>;
  updatedAt?: Resolver<Maybe<ResolversTypes['String']>, ParentType, ContextType>;
  userId?: Resolver<ResolversTypes['String'], ParentType, ContextType>;
  __isTypeOf?: IsTypeOfResolverFn<ParentType, ContextType>;
}>;

export type QueryResolvers<ContextType = Context, ParentType extends ResolversParentTypes['Query'] = ResolversParentTypes['Query']> = ResolversObject<{
  allExpenses?: Resolver<Maybe<Array<Maybe<ResolversTypes['Expense']>>>, ParentType, ContextType>;
  allInvestmentRecords?: Resolver<Maybe<Array<ResolversTypes['InvestmentRecord']>>, ParentType, ContextType>;
  cardById?: Resolver<Maybe<ResolversTypes['Card']>, ParentType, ContextType, RequireFields<QueryCardByIdArgs, 'cardId'>>;
  cardList?: Resolver<Maybe<Array<Maybe<ResolversTypes['Card']>>>, ParentType, ContextType>;
  categoryAllocation?: Resolver<Maybe<ResolversTypes['CategoryAllocation']>, ParentType, ContextType, RequireFields<QueryCategoryAllocationArgs, 'input'>>;
  categoryList?: Resolver<Maybe<Array<ResolversTypes['Categories']>>, ParentType, ContextType>;
  categorySettings?: Resolver<Maybe<ResolversTypes['CategorySettings']>, ParentType, ContextType>;
  expenseById?: Resolver<Maybe<ResolversTypes['Expense']>, ParentType, ContextType, RequireFields<QueryExpenseByIdArgs, 'id'>>;
  financialBalanceByFortnight?: Resolver<Maybe<ResolversTypes['FinancialBalance']>, ParentType, ContextType, RequireFields<QueryFinancialBalanceByFortnightArgs, 'input'>>;
  incomeById?: Resolver<Maybe<ResolversTypes['Income']>, ParentType, ContextType, RequireFields<QueryIncomeByIdArgs, 'incomeId'>>;
  incomesGroupedBy?: Resolver<Maybe<Array<ResolversTypes['IncomesGroupedBy']>>, ParentType, ContextType>;
  incomesList?: Resolver<Maybe<ResolversTypes['IncomesList']>, ParentType, ContextType>;
  incomesWithExpenses?: Resolver<ResolversTypes['IncomesListAndExpenses'], ParentType, ContextType, RequireFields<QueryIncomesWithExpensesArgs, 'input'>>;
  login?: Resolver<ResolversTypes['LoginResponse'], ParentType, ContextType>;
  period?: Resolver<Maybe<ResolversTypes['Period']>, ParentType, ContextType, RequireFields<QueryPeriodArgs, 'input'>>;
  periodsList?: Resolver<Maybe<Array<ResolversTypes['Period']>>, ParentType, ContextType>;
  udiValue?: Resolver<ResolversTypes['UdiValue'], ParentType, ContextType>;
}>;

export type SubCategoryResolvers<ContextType = Context, ParentType extends ResolversParentTypes['SubCategory'] = ResolversParentTypes['SubCategory']> = ResolversObject<{
  id?: Resolver<ResolversTypes['ID'], ParentType, ContextType>;
  name?: Resolver<ResolversTypes['String'], ParentType, ContextType>;
  userId?: Resolver<Maybe<ResolversTypes['ID']>, ParentType, ContextType>;
  __isTypeOf?: IsTypeOfResolverFn<ParentType, ContextType>;
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

export type UdiValueResolvers<ContextType = Context, ParentType extends ResolversParentTypes['UdiValue'] = ResolversParentTypes['UdiValue']> = ResolversObject<{
  amount?: Resolver<Maybe<ResolversTypes['String']>, ParentType, ContextType>;
  date?: Resolver<Maybe<ResolversTypes['String']>, ParentType, ContextType>;
  __isTypeOf?: IsTypeOfResolverFn<ParentType, ContextType>;
}>;

export type Resolvers<ContextType = Context> = ResolversObject<{
  Card?: CardResolvers<ContextType>;
  Categories?: CategoriesResolvers<ContextType>;
  CategoryAllocation?: CategoryAllocationResolvers<ContextType>;
  CategorySetting?: CategorySettingResolvers<ContextType>;
  CategorySettings?: CategorySettingsResolvers<ContextType>;
  CategorySum?: CategorySumResolvers<ContextType>;
  CategoryType?: CategoryTypeResolvers<ContextType>;
  Date?: GraphQLScalarType;
  Expense?: ExpenseResolvers<ContextType>;
  ExpensesBy?: ExpensesByResolvers<ContextType>;
  FinancialBalance?: FinancialBalanceResolvers<ContextType>;
  GroupedExpenses?: GroupedExpensesResolvers<ContextType>;
  Income?: IncomeResolvers<ContextType>;
  IncomesGroupedBy?: IncomesGroupedByResolvers<ContextType>;
  IncomesList?: IncomesListResolvers<ContextType>;
  IncomesListAndExpenses?: IncomesListAndExpensesResolvers<ContextType>;
  InvestmentRecord?: InvestmentRecordResolvers<ContextType>;
  LoginResponse?: LoginResponseResolvers<ContextType>;
  Mutation?: MutationResolvers<ContextType>;
  PaymentDate?: PaymentDateResolvers<ContextType>;
  Period?: PeriodResolvers<ContextType>;
  Query?: QueryResolvers<ContextType>;
  SubCategory?: SubCategoryResolvers<ContextType>;
  Total?: TotalResolvers<ContextType>;
  TotalByCardId?: TotalByCardIdResolvers<ContextType>;
  TotalByFortnight?: TotalByFortnightResolvers<ContextType>;
  TotalByMonth?: TotalByMonthResolvers<ContextType>;
  UdiValue?: UdiValueResolvers<ContextType>;
}>;

