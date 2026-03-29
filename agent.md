# Agent Context — expenses-graphql

This file provides deep context for AI agents working with the expenses-graphql backend. For high-level project overview and commands, see the root `CLAUDE.md`.

## Quick Start

```bash
# 1. Start the database
docker compose up db -d

# 2. Install dependencies
pnpm install

# 3. Run migrations and seeds
pnpm migrate && pnpm seeds

# 4. Start dev server
pnpm dev          # port 4000
# or
pnpm watch        # codegen + tsc + nodemon (concurrent)

# 5. GraphQL Playground
open http://localhost:4000/graphql
```

## Tech Stack

| Layer           | Technology                                    |
|-----------------|-----------------------------------------------|
| Runtime         | Node 22.4.0 (ESM, `.js` extensions required)  |
| Language        | TypeScript 5.3+                               |
| API             | Apollo Server 4, GraphQL 16                   |
| ORM             | Sequelize 6 (PostgreSQL 16)                   |
| Auth            | JWT via `x-session-key` header, JWKS          |
| Validation      | Zod (MCP tools)                               |
| Logging         | Winston (never use `console.log`)             |
| Testing         | Vitest (globals enabled, `@/` alias)          |
| Codegen         | `@graphql-codegen/cli` (schema-first)         |
| Package Manager | pnpm                                          |
| Deployment      | Fly.io                                        |

## Architecture

```
Request → Apollo Server (context: user, sequelizeClient, axiosClient)
       → Resolver (thin, delegates to service)
       → Service (business logic, validation)
       → Repository (Sequelize queries, returns DTOs via adapters)
       → Adapter (transforms raw Sequelize → DTO or GraphQL types)
```

### Key Principle: Schema-First GraphQL

`schema.graphql` is the source of truth. After modifying it, run `pnpm codegen` to regenerate `src/generated/graphql.ts`. Never edit generated files directly.

## Database

### Local Development

Docker Compose provides PostgreSQL 16:
```
Host: 127.0.0.1 | Port: 5432 | User: root | Password: admin | DB: expenses
```

Environment variables in `.env`:
```
DB_HOST=127.0.0.1
DB_PORT=5432
DB_USER=root
DB_PASSWORD=admin
DB_NAME=expenses
```

Production uses `DATABASE_URL` (Fly.io).

### Sequelize Configuration

- `config/config.json` — Sequelize CLI config (migrations, seeds)
- `src/database/client.ts` — Runtime client (reads from `.env`)
- Migrations are in `migrations/` (CommonJS `.cjs` files)
- Model associations defined in `src/models/associations.ts`

### Core Models and Relationships

```
Income ──┐
         ├── Period (biweekly pay periods)
Expense ─┘
  ├── SubCategory → Category (hierarchical)
  ├── Card (payment method)
  └── IncomeCategoryAllocation (budget tracking)

CategorySettings (percentage allocation per category)
InvestmentRecord / InvestmentFeeRecord (UDI investments)
```

## Code Patterns — Follow These Strictly

### Adding a New Query

1. **Schema**: Add type + query to `schema.graphql`
2. **Codegen**: Run `pnpm codegen`
3. **Repository**: Add data access method returning `SomeDTO[]`
   - Use Sequelize typed `findAll`/`findOne` with `include` (prefer over raw SQL)
   - Always scope by `userId`
   - Category queries use `[Op.or]: [{ userId: null }, { userId: this.userId }]`
4. **Adapter**: Transform DTO → GraphQL type
   - Use `.reduce()` with plain objects + `Object.values().map()` for grouping
   - Never use `for` loops or `Array.from()`
   - Use `formatCurrency()` from `income-adapter.ts` for money formatting
5. **Service**: Thin pass-through with date parsing if needed
6. **Resolver**: Create in `src/resolvers/query/<feature>/<name>.ts`
   - Extract `userId` and `sequelizeClient` from context
   - Delegate to service
7. **Register**: Export from `src/resolvers/query/index.ts`, add to `queries.ts` with `withErrorHandling`

### Adding a New Mutation

Same layered approach. Mutations live in `src/resolvers/mutation/<feature>/`. Register in `src/resolvers/mutation.ts`.

### Adding an MCP Tool

MCP tools live in `src/mcp/tools/<domain>-tools.ts`. Each file exports a `register<Domain>Tools(server, userId)` function.

```typescript
server.registerTool(
  'tool-name',
  {
    description: 'What this tool does',
    inputSchema: { param: z.string().describe('Description') },
  },
  async (input) => {
    try {
      const service = new SomeService(userId, sequelizeClient);
      const result = await service.someMethod(input.param);
      return textResponse(adaptedResult);
    } catch (error) {
      return errorResponse(error.message);
    }
  }
);
```

Register new tool files in `src/mcp/server.ts`.

The MCP server runs via `pnpm mcp` and requires `MCP_USER_ID` env var. It uses stdio transport.

### Adapter Patterns

Adapters transform data between layers. Key conventions:

- `adaptSingleRawExpenseDTO(raw)` — Sequelize raw → `ExpenseDTO`
- `adaptRawListExpense(list)` — Maps over list using single adapter
- `adaptExpensesDTOInput(dto)` — `ExpenseDTO` → GraphQL `Expense` type
- `adaptExpensesByCategoryDTO(dtos)` — Flat list → grouped nested structure
- `adaptCategoryDTO(category, subCategory?)` — Handles category/subcategory nesting

The category adapter attaches subcategories as `category.subCategories[]`, so to access a subcategory from an `ExpenseDTO`, use `expense.category.subCategories[0]`.

## File Organization

```
src/
├── index.ts                    # Apollo Server setup, Context interface
├── schema.graphql              # GraphQL schema (source of truth)
├── logger.ts                   # Winston logger instance
├── generated/graphql.ts        # Auto-generated — DO NOT EDIT
├── scalars/date.ts             # Custom Date scalar
├── auth/
│   ├── resolve-user.ts         # JWT → User from request headers
│   └── verify-jwt.ts           # JWKS verification
├── database/
│   ├── client.ts               # Sequelize instance
│   └── sync-database.ts        # Table sync on startup
├── models/                     # Sequelize model definitions
│   ├── associations.ts         # All model relationships
│   ├── expense.ts, income.ts, card.ts, category.ts, sub-category.ts, ...
│   └── index.ts                # Re-exports
├── dto/                        # TypeScript types for data transfer
│   ├── expense-dto.ts          # ExpenseDTO, GroupedExpensesDTO, etc.
│   └── ...
├── adapters/                   # Data transformation functions
│   ├── expense-adapter.ts      # Raw → DTO, DTO → GraphQL
│   ├── income-adapter.ts       # Also contains adaptExpensesDTOInput, formatCurrency
│   └── ...
├── repository/                 # Data access layer
│   ├── expense-repository.ts   # All expense queries
│   └── ...
├── service/                    # Business logic
│   ├── expenses-service.ts     # Expense CRUD + grouped queries
│   └── ...
├── resolvers/
│   ├── queries.ts              # All query resolver registrations
│   ├── mutation.ts             # All mutation resolver registrations
│   ├── query/                  # One file per query, organized by feature
│   │   ├── expense/            # all-expenses, expense-by-id, expenses-by-category, ...
│   │   ├── income/             # incomes-list, income-by-id, incomes-grouped
│   │   ├── card/               # card-list, card-by-id
│   │   ├── category/           # category-list, category-settings, category-allocation
│   │   ├── composites/         # incomes-with-expenses
│   │   ├── investment/         # all-investment-records, investment-details, udi-value
│   │   ├── period/             # periods-list, period
│   │   └── login/              # login resolver
│   └── mutation/               # One file per mutation, organized by feature
├── mcp/                        # Model Context Protocol server
│   ├── index.ts                # Entry point (requires MCP_USER_ID)
│   ├── server.ts               # Tool registration orchestrator
│   ├── tools/                  # Tool definitions by domain
│   │   ├── expense-tools.ts    # CRUD + expenses-by-category
│   │   ├── income-tools.ts
│   │   ├── category-tools.ts
│   │   ├── card-tools.ts
│   │   └── period-tools.ts
│   └── utils.ts                # textResponse, errorResponse helpers
├── clients/
│   └── banxico/udi-client.ts   # External API for UDI investment values
└── utils/
    ├── resolver-wrapper.ts     # withErrorHandling HOF for resolvers
    ├── date-utils.ts           # Fortnight calculation, date helpers
    ├── calculate-total.ts      # Sum utilities
    ├── case-converter.ts       # Snake_case ↔ camelCase (for raw SQL results)
    ├── expenses-utils.ts       # Expense-specific helpers
    ├── where-fortnight.ts      # Fortnight date range builder
    └── sequilize-utils.ts      # Sequelize query helpers
```

## Code Style Rules

- **Single quotes**, 2-space indent
- **No `console.log`** — use `logger.info/error/warn` from `src/logger.ts`
- **ESM imports** — always use `.js` extension in import paths
- **No `for` loops** — use `.map()`, `.reduce()`, `.filter()`, `Object.values()`
- **No `Array.from()`** — use spread or `.map()` instead
- **Prefer Sequelize typed queries** over raw SQL for new code
- **Adapters handle transformation** — repositories return raw/DTO data, adapters convert
- **Thin resolvers** — extract context, delegate to service, return adapted result

## Testing

```bash
pnpm test              # Watch mode
pnpm test -- --run     # Single run
```

- Vitest with global imports (`describe`, `it`, `expect` available without import)
- Path alias `@/` maps to `src/`
- Test files: `*.test.ts` (currently no test files exist in `src/`)

## Deployment

- **Production**: Fly.io via `pnpm deploy:prod` (builds, then `fly deploy`)
- **Docker dev**: `docker compose up` spins up both PostgreSQL and the API
- **Dockerfile.dev**: Node 22.4.0-slim, pnpm 10.23.0, exposes port 4000

## Common Gotchas

1. **Always run `pnpm codegen` after changing `schema.graphql`** — TypeScript types and resolver signatures won't update otherwise.
2. **Category scoping** — Categories can be global (`userId: null`) or user-specific. Always include `[Op.or]: [{ userId: null }, { userId: this.userId }]` in category queries.
3. **SubCategory access from ExpenseDTO** — The category adapter nests the subcategory inside `category.subCategories[0]`, not as a top-level field.
4. **Date handling** — Dates are stored as PostgreSQL timestamps. Use `date-fns`/`date-fns-tz` for formatting. The `formatInTimeZone(date, 'UTC', pattern)` pattern is used throughout.
5. **Currency formatting** — Always use `formatCurrency()` from `income-adapter.ts`. It formats as USD (`$1,234.56`).
6. **ESM modules** — Import paths must end in `.js` even for `.ts` files. This is a TypeScript + ESM requirement.
7. **Sequelize associations** — Use `as: 'sub_category'` (snake_case) for the SubCategory association on Expense. The model aliases are defined in `models/associations.ts`.
8. **MCP server** — Runs as a separate process (`pnpm mcp`), not inside Apollo Server. Requires `MCP_USER_ID` env var to scope all queries to a specific user.

## GraphQL Schema Highlights

### Key Queries
- `allExpenses` — All user expenses
- `expensesByCategory(input: FilterInput!)` — Expenses grouped by category/subcategory
- `incomesWithExpenses(input: FilterInput!)` — Income + grouped expenses for a period
- `categoryAllocation(input: CategoryAllocationInput!)` — Budget allocation vs actual spending
- `financialBalanceByFortnight(input: PayBeforeInput!)` — Remaining balance per fortnight

### Key Mutations
- `createExpense/updateExpense/deleteExpense` — Expense CRUD
- `createIncome/updateIncome/deleteIncomeById` — Income CRUD
- `createCard/updateCard/deleteCard` — Payment card management
- `createCategorySetting/updateCategorySetting` — Budget percentage settings
- `createInvestmentRecord` — UDI investment tracking

### FilterInput (most common query input)
```graphql
input FilterInput {
  cardId: ID
  periodId: ID
  startDate: Date
  endDate: Date
  subCategoryIds: [ID!]
  month: String
  year: String
}
```
