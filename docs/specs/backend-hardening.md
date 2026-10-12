# Backend Hardening

Running log of backend startup / database hardening fixes. Extend this file
as more items are added.

## Item A — `syncTables` no longer swallows connection errors

**Status:** ✅ Done

**Problem:** `src/database/sync-database.ts` caught DB connection/sync errors,
logged them, and returned normally. The server then started **without a
database**, serving requests that would all fail at query time, and the process
exited `0` so orchestrators saw a "healthy" boot.

**Fix:**
- `syncTables` now re-throws the error after logging it.
- `src/index.ts` wraps `startServer()` in `.catch()` that logs and calls
  `process.exit(1)`, so a DB failure aborts startup before the GraphQL server
  is created.

**Acceptance:** With an invalid `DATABASE_URL` the process exits non-zero and
never reaches `startStandaloneServer`. Verified end-to-end:

```
NODE_ENV=production DATABASE_URL="postgres://u:p@no-such-db-host.invalid:5432/d" \
  node --loader ts-node/esm src/index.ts
# → "Failed to sync tables getaddrinfo ENOTFOUND ..."
# → "Failed to start server ..."
# → exit code 1, no "Server ready" log
```

## Item B — `sequelize.sync()` no longer runs in production

**Status:** ✅ Done

**Problem:** Startup called `sequelize.sync()` unconditionally even though the
schema is owned by the SQL migrations in `/migrations`. In production this
caused schema drift between what Sequelize inferred from the models and what the
migrations defined.

**Fix:**
- `sequelize.sync()` is now gated behind `process.env.NODE_ENV !== 'production'`
  in `src/database/sync-database.ts`. In production the schema is managed
  exclusively by migrations.
- Added a `release_command` to `fly.toml` so migrations run on every deploy:

  ```toml
  [deploy]
    release_command = "npx sequelize-cli db:migrate --config dist/config/config.cjs --migrations-path dist/migrations"
  ```

  (Assets are compiled into `dist/` by the build step, so the CLI is pointed at
  the compiled `config`/`migrations`.)

**Acceptance:** In production the boot path does not call `sync()`; `fly.toml`
has a `release_command` running `db:migrate`. Covered by unit tests in
`test/src/database/sync-database.spec.ts` (asserts `sync()` is not called when
`NODE_ENV=production`, and is called otherwise).

## Item C — sequelize-cli production config now resolves env vars

**Status:** ✅ Done

**Problem:** `config/config.json` had literal strings such as
`"process.env.DATABASE_PASSWORD"` / `"process.env.DATABASE_HOST"` in the
`production` block. JSON cannot execute code, so these were never resolved and
`db:migrate` could not connect in production.

**Fix:**
- Replaced `config/config.json` with `config/config.cjs` (CommonJS), which reads
  environment variables at runtime.
  - `development` / `test` mirror the `DB_*` variables used by the non-production
    Sequelize client in `src/database/client.ts` (with sensible local defaults).
  - `production` uses `use_env_variable: 'DATABASE_URL'`, matching the prod
    client.
- Added `.sequelizerc` pointing the CLI at `config/config.cjs` and the
  `migrations`/`seeders`/`models` folders.
- Added a `db:migrate` npm script.

**Acceptance:** `npx sequelize-cli db:migrate` reads env vars locally and the
production block uses `DATABASE_URL`. Verified the config loads and resolves env
vars (connection is attempted against the *env-provided* host, not a literal
string):

```
# dev reads DB_HOST
DB_HOST=dev-env-host.invalid ... npx sequelize-cli db:migrate:status
# → Loaded configuration file "config/config.cjs"
# → ERROR: getaddrinfo ENOTFOUND dev-env-host.invalid

# prod uses DATABASE_URL
NODE_ENV=production DATABASE_URL="postgres://u:p@prod-url-host.invalid:5432/d" \
  npx sequelize-cli db:migrate:status
# → Loaded configuration file "config/config.cjs"
# → ERROR: getaddrinfo ENOTFOUND prod-url-host.invalid
```

## Commands run & results

- `pnpm lint` — passes for all changed files (`src/database/sync-database.ts`,
  `src/index.ts`, `test/src/database/sync-database.spec.ts`). The suite still
  reports **pre-existing** `@typescript-eslint/no-explicit-any` errors in
  existing service/repository spec files; these are unrelated to this work and
  were left untouched (out of scope).
- `pnpm test` — 19 passing, including the 3 new `syncTables` tests. The 2
  failures in `test/src/repository/period-repository.spec.ts` are
  **pre-existing** (fortnight date/timezone assertions) and out of scope for
  this change.

## Notes / out of scope

- Pre-existing lint errors (`no-explicit-any`) in existing spec files were not
  addressed.
- Pre-existing failing tests in `period-repository.spec.ts` were not addressed.
- `src/mcp/index.ts` already exits non-zero on startup failure (its `start()`
  has a `.catch(process.exit(1))`), so it benefits from the Item A re-throw
  without further changes.
