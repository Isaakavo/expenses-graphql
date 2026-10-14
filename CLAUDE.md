# CLAUDE.md

Guidance for agents working in `expenses-graphql`. Deep reference (code patterns, adapters, schema highlights, gotchas): `agent.md`. Read only the section you need.

Use the file map below to open the right file directly instead of searching the tree.

## Commands

```bash
pnpm codegen && pnpm build && TZ=UTC pnpm vitest run   # checks before a PR
npx eslint <changed files>                             # pnpm lint has ~31 pre-existing errors
pnpm dev                                               # port 4000, needs .env and the docker DB
pnpm migrate                                           # local DB only
```

## Rules

- Schema first: edit `schema.graphql`, run `pnpm codegen`, never edit `src/generated/`.
- Request flow: resolver (thin), then service (validation, transactions), then repository (Sequelize, `userId` scoped), then adapter (DTO to GraphQL).
- Errors: `GraphQLError` with `VALIDATION_ERROR` (+ `argumentName`) or a specific code (e.g. `GOAL_NOT_FOUND`).
- Validate before `sequelize.transaction()`; a failed write must leave no orphan rows.
- Resolvers that build a service pass `sequelizeClient` from the context.
- Goal SPENDING expenses are excluded from every non-goal read: `excludeGoalSpending` in `src/utils/expenses-utils.ts`, or `goal_role IS DISTINCT FROM 'SPENDING'` in raw SQL.
- ESM: imports end in `.js`. Log with `logger` (Winston), never `console.log`.
- New migrations go in `migrations/` as `.cjs` with a working `down`. They run on Fly deploy (`release_command` in `fly.toml`).
- Tests use mocks or in-memory sqlite. Never point tests at the dev DB.
- **No slop comments (hard rule).** Add a comment only when the code cannot say it: a non-obvious why (a quirk, a workaround, an ordering constraint, an external limit), in one line. Never write a comment that restates the code or a name, narrates steps, describes the change or its history ("now", "fixed", "added"), explains test data defined nearby, or a KDoc/JSDoc that repeats the signature. When in doubt, delete it. Reviewers report every slop comment as blocking.

## File map

```
schema.graphql            GraphQL schema (source of truth)
codegen.ts                codegen config; contextType = src/index.ts#Context
config/config.cjs         sequelize-cli config (production uses DATABASE_URL)
migrations/               category-settings, expense-subcategory-required, periods, add-goals
seeders/                  default categories and category settings
fly.toml                  Fly app, primary_region dfw, release_command runs migrations
.github/workflows/        ci.yml (build + test on PR), fly-deploy.yml (manual deploy)
docs/specs/               backend-hardening.md

src/
  index.ts                Apollo server, Context interface, per-request context
  logger.ts               Winston logger
  scalars/date.ts         Date scalar
  generated/graphql.ts    codegen output, do not edit
  auth/                   resolve-user (JWT from x-session-key), verify-jwt (JWKS), axios-instance, client
  clients/banxico/        udi-client (UDI values for investments)
  database/               client (Sequelize instance), sync-database (sync only outside production)
  loaders/                createLoaders: per-request DataLoaders (goalExpenses for Goal.expenses)
  models/                 card, category, sub-category, category-settings, expense, goal, income,
                          income-category-allocation, investment-record, investment-fee-record, periods;
                          associations.ts (relations), init-models.ts
  dto/                    card, category, expense, goal, income, investment, period
  adapters/               card, category, expense, goal, income (adaptExpensesDTOInput, formatCurrency),
                          investment, period
  repository/             card, category, category-settings, category-allocation, expense, goal,
                          income, investment, period (createPeriod overlap rules)
  service/                category, category-setting, category-allocation, expenses (create/update/fixed,
                          goal link checks), goal, income, investment, period
  resolvers/
    queries.ts            registers every query (withErrorHandling)
    mutation.ts           registers every mutation
    types/goal-types.ts   Goal.expenses field resolver
    query/<feature>/      card, category, composites (incomes-with-expenses), expense, goal, income,
                          investment, login, period: one file per query
    mutation/<feature>/   card, category, expenses, goal, income, investment: one file per mutation
  mcp/                    server.ts (registers tools), utils.ts, tools/{card,category,expense,income,period}-tools.ts
  utils/                  expenses-utils (excludeGoalSpending), date-utils, where-fortnight,
                          calculate-total, case-converter, resolver-wrapper, sequilize-utils

test/src/                 mirrors src/
  repository/             expense (+ -sql), goal, income, period specs
  service/                expenses, goal, category-setting specs
  database/               sync-database spec
  loaders/                loaders spec
```
