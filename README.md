# Expenses GraphQL API

A GraphQL API for personal finance management built with TypeScript, Apollo Server, and PostgreSQL via Sequelize ORM. Handles income, expenses, investments, cards, categories, and financial period tracking.

## Prerequisites

- Node.js 22.4.0 (see `.nvmrc`)
- pnpm 10.x
- PostgreSQL (local for dev, Fly.io managed for production)

## Getting Started

```bash
# Install dependencies
pnpm install

# Configure environment variables (see Environment section below)
cp .env.example .env  # or create .env manually

# Run database migrations
pnpm migrate

# (Optional) Seed the database
pnpm seeds

# Start development server (port 4000)
pnpm dev
```

## Commands

| Command | Description |
|---------|-------------|
| `pnpm dev` | Start dev server with nodemon (port 4000) |
| `pnpm watch` | Concurrent: GraphQL codegen + TypeScript compilation + nodemon |
| `pnpm build` | Production build (codegen, compile, copy assets) |
| `pnpm test` | Run vitest (watch mode) |
| `pnpm test -- --run` | Run tests once |
| `pnpm lint` | ESLint |
| `pnpm codegen` | Generate TypeScript types from `schema.graphql` |
| `pnpm codegen:watch` | Watch mode for codegen |
| `pnpm migrate` | Run Sequelize database migrations |
| `pnpm seeds` | Run Sequelize database seeders |
| `pnpm deploy:prod` | Build and deploy to Fly.io |

## Environment Variables

### Development (`.env`)

```
DB_HOST=localhost
DB_PORT=5432
DB_USER=<your_user>
DB_PASSWORD=<your_password>
DB_NAME=<your_database>
```

### Production

```
NODE_ENV=production
DATABASE_URL=<fly_postgres_connection_string>
```

Production uses a single `DATABASE_URL` connection string. Development uses individual DB parameters. See `src/database/client.ts` for the conditional logic.

## Architecture

### Layered Structure

```
Request
  |
  v
Apollo Server (src/index.ts)
  |-- Context: resolves authenticated user via JWT
  |
  v
Resolvers (src/resolvers/)
  |-- query/   -> read operations
  |-- mutation/ -> write operations
  |
  v
Services (src/service/)
  |-- Business logic, validation, data transformation
  |
  v
Repositories (src/repository/)
  |-- Sequelize queries, raw SQL for complex aggregations
  |
  v
Models (src/models/)
  |-- Sequelize model definitions + associations
  |
  v
PostgreSQL
```

### Request Flow

1. Apollo Server receives a GraphQL request
2. The context factory in `src/index.ts` extracts the JWT from the `x-session-key` header and verifies it via JWKS (AWS Cognito)
3. The authenticated `User` (with `userId`) is added to the context
4. The resolver creates a service instance, passing `userId` and `sequelizeClient`
5. The service instantiates its repositories and performs business logic
6. Repositories execute Sequelize queries and return raw model data
7. Adapters (`src/adapters/`) transform Sequelize model instances into DTOs
8. DTOs are returned to the resolver, which maps them to GraphQL response types

### Directory Reference

```
src/
  index.ts             Entry point, Apollo Server setup, Context type definition
  schema.graphql       GraphQL schema (types, queries, mutations)
  logger.ts            Winston logger configuration
  resolvers/
    index.ts           Combines Query and Mutation resolvers
    queries.ts         Maps all query resolver functions
    mutation.ts        Maps all mutation resolver functions
    query/             Individual query resolvers by domain
      card/
      category/
      composites/      Combined queries (e.g., incomes with expenses)
      expense/
      income/
      investment/
      login/
      period/
    mutation/          Individual mutation resolvers by domain
      card/
      category/
      expenses/
      income/
      investment/
  service/             Business logic layer (class-based, receives userId + sequelize)
    category-allocation-service.ts
    category-service.ts
    category-setting-service.ts
    expenses-service.ts
    income-service.ts
    investment-service.ts
    period-service.ts
  repository/          Data access layer (class-based, wraps Sequelize operations)
  models/              Sequelize model definitions
    associations.ts    Defines all model relationships
    index.ts           Re-exports all models, calls initModel + associateModels
  dto/                 Data Transfer Object type definitions
  adapters/            Functions to transform Sequelize models into DTOs
  auth/
    resolve-user.ts    Extracts and validates JWT from request headers
    verify-jwt.ts      JWT verification using JWKS (Cognito)
    axios-instance.ts  Axios client for external API calls
  database/
    client.ts          Sequelize client initialization (dev vs production)
    sync-database.ts   Model initialization and table sync
  clients/             External API clients
  scalars/             Custom GraphQL scalars (Date)
  generated/           Auto-generated types from codegen (do not edit)
  utils/               Shared utilities (date formatting, case conversion, calculations)
config/
  config.json          Sequelize CLI config (migrations, seeders)
migrations/            Database migration files (CommonJS)
seeders/               Database seed files
test/
  src/
    repository/        Repository unit tests
    service/           Service unit tests
```

### Domain Model Relationships

The core entities and their relationships:

- **Income** belongs to a **Period** (pay period / date range)
- **Expense** belongs to a **SubCategory**, optionally to a **Card** and **Period**
- **SubCategory** belongs to a **Category**
- **Category** has many **SubCategories**
- **Card** has many **Expenses**
- **Period** has many **Incomes** and **Expenses**
- **CategorySettings** belongs to a **Category** (budget percentage allocation per user)
- **IncomeCategoryAllocation** links **Income** to **CategorySettings** for tracking spending against budgets

All entities are scoped by `userId` for multi-tenant data isolation.

### Key Patterns

**Service instantiation**: Services and repositories are created per-request in resolvers, receiving the authenticated `userId` and `sequelizeClient` from context. This ensures user-scoped data access.

**Database column mapping**: Sequelize models use camelCase in TypeScript but `underscored: true` for snake_case database columns. The `field` option maps individual columns where needed.

**Adapters**: Adapter functions in `src/adapters/` handle the transformation between Sequelize model instances (which include metadata, associations, etc.) and clean DTO objects that match the GraphQL schema.

**Custom Date scalar**: The `Date` scalar in `src/scalars/date.ts` handles serialization/parsing between GraphQL and JavaScript Date objects.

### Authentication

- JWT tokens are issued by AWS Cognito
- The client sends the access token in the `x-session-key` HTTP header
- `resolve-user.ts` extracts the token and calls `verify-jwt.ts`
- `verify-jwt.ts` validates the token against Cognito's JWKS endpoint
- The decoded user payload (containing `userId`) is attached to the Apollo context

### GraphQL Schema

The schema is defined in `schema.graphql` at the project root. Key types:

- **Query**: 17 queries covering all domains (expenses, incomes, cards, categories, periods, investments)
- **Mutation**: 14 mutations for CRUD operations
- **Custom scalar**: `Date`
- **Enums**: `Fortnight` (FIRST, SECOND), `Category` (deprecated enum), `FixedExpenseFrequency` (Biweekly, Monthly)
- **Interface**: `Total` (shared fields for aggregation results)

### Code Generation

GraphQL types are auto-generated from `schema.graphql` using `@graphql-codegen/cli`. Configuration is in `codegen.ts`. Generated output goes to `src/generated/graphql.ts`. Run `pnpm codegen` after modifying the schema.

### Testing

Tests use vitest with the `node` environment. Path alias `@/` maps to `./src/`. Tests are organized under `test/src/` mirroring the source structure (repository and service tests).

### Deployment

- Deployed on Fly.io (see `fly.toml`)
- App name: `expenses-graphql`, region: `mia` (Miami)
- Port 3000 in production, HTTPS enforced
- Docker-based deployment using multi-stage Dockerfile
- Deploy with `pnpm deploy:prod`

### Code Style

- Single quotes, 2-space indentation
- No `console.log` (use the winston `logger` from `src/logger.ts`)
- ESM modules with `.js` import extensions
