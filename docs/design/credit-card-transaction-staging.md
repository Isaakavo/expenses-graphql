# Design: Credit Card Transaction Staging & Auto-Import

Status: draft for review. No code has been written against this document yet.

## 1. Goal / Summary

Today every `Expense` is entered by hand. This feature connects the user's
credit cards (Bank of America, Chase, Wells Fargo, via **Teller.io**) so
transactions are detected automatically, land in a new **staging area**
(`staged_transactions`), arrive pre-populated with a suggested `SubCategory`
and `Period`, and can be reviewed and **promoted** into a real `Expense` with
one mutation. Detection happens through three complementary paths: a webhook
(near real-time), a scheduled poll (safety net), and a manual "sync now"
mutation.

The codebase must not become coupled to Teller: everything above the
`src/providers/teller/` folder talks only to a generic `TransactionProvider`
interface. Swapping or adding a provider later should not touch
Service/Repository/Resolver/Adapter/GraphQL code.

This is a single-user app; there is no multi-tenant/billing complexity to
design for. All new server-side code still scopes every query by `userId`
per existing convention, and all new resolvers still go through
`x-session-key` JWT auth like every other resolver.

### Out of scope
- Bank-to-account reconciliation / balance tracking (Teller exposes balances,
  we don't use them here).
- Automatic promotion without human review (everything lands in staging;
  promotion is always an explicit mutation call, even when auto-suggestion is
  confident).
- Multi-provider-per-card, multi-card-per-provider-account, shared/family
  accounts.
- A queue/worker system (BullMQ, etc.) — volume is one user's worth of
  transactions, so synchronous in-request processing is sufficient. Flagged
  as a gap-fill decision below.

## 2. Architecture at a glance

```
Teller Connect (frontend widget)
        │  access token
        ▼
linkCardToProvider mutation ──► Card row gets provider_* columns (encrypted token)

Teller webhook ──► POST /webhooks/:provider ──┐
Fly Machine cron (hourly) ──► run-transaction-sync-job.ts ──┤──► TransactionSyncService
syncTransactions mutation ──────────────────────────────────┘         │
                                                                       ▼
                                                     TransactionProvider.listTransactions()
                                                     (TellerProvider, mTLS client)
                                                                       │
                                                        map → generic ProviderTransaction
                                                                       │
                                                    CategorySuggestionService (subCategory)
                                                    PeriodRepository.getPeriodBy (period, read-only)
                                                                       │
                                                                       ▼
                                                    staged_transactions (upsert, idempotent)
                                                                       │
                                          stagedTransactions query (user reviews in UI)
                                                                       │
                                              promoteStagedTransaction mutation
                                                                       │
                                        PeriodRepository.getPeriodBy/createPeriod (get-or-create)
                                        ExpenseRepository.createExpense — same pattern as
                                        ExpensesService.createFixedExpenses (single transaction,
                                        rollback on failure)
                                                                       │
                                                                       ▼
                                                                  Expense row
```

## 3. Data model changes

### 3.1 `Cards` table — additive migration

**Important existing-schema gotcha, verified by reading the code, not
assumed:** the `Card` model (`src/models/card.ts`) has no `underscored: true`
and no `tableName` override, and it predates the migrations folder (it was
created by `sequelize.sync()`, not a `.cjs` file — there is no migration in
`/migrations` that creates the cards table). Its actual Postgres table is the
quoted identifier `"Cards"` (capital C) with **camelCase** columns, confirmed
by the raw SQL in `src/repository/expense-repository.ts:209`
(`LEFT JOIN "Cards" cd ON e.card_id = cd.id`). This is different from every
other table added since (`periods`, `expenses`, `category_settings`, etc.),
which are lowercase/snake_case and migration-created.

**Consequence for the implementor:** the new migration must target the table
literally named `Cards` (not `cards`), and the new columns must be camelCase
to match the model's existing no-`underscored` convention, so the Sequelize
attribute name maps to the column name with no `field:` override needed —
exactly like `alias`, `isDebit`, `isDigital` do today.

New migration: `migrations/20260829000000-cards-provider-link.cjs`

Additive, nullable, no backfill, no downtime:

| Column                          | Type                | Nullable | Notes |
|----------------------------------|---------------------|----------|-------|
| `provider`                       | `STRING`            | yes      | e.g. `'teller'`. Lowercase, provider-defined string, not a Postgres ENUM (see rationale below). |
| `providerAccountId`               | `STRING`            | yes      | The provider's id for this specific account (Teller: account id). |
| `providerConnectionId`            | `STRING`            | yes      | The provider's id for the auth/enrollment this account belongs to (Teller: enrollment id). Not unique per card — one connection can cover multiple accounts/cards. |
| `providerAccessTokenCiphertext`   | `TEXT`              | yes      | AES-256-GCM ciphertext, base64. See §3.3. |
| `providerAccessTokenIv`           | `STRING`            | yes      | Base64 IV used for that ciphertext. |
| `providerAccessTokenAuthTag`      | `STRING`            | yes      | Base64 GCM auth tag. |
| `providerStatus`                  | `STRING`            | yes      | App-level enum-as-string: `'ACTIVE' \| 'DISCONNECTED' \| 'ERROR'`. String, not Postgres ENUM — altering a Postgres ENUM type later (adding a value) requires `ALTER TYPE ... ADD VALUE` outside a transaction, which is exactly the kind of migration friction this column should never cause. |
| `providerLinkedAt`                | `DATE`              | yes      | When `linkCardToProvider` succeeded. |
| `providerLastSyncedAt`            | `DATE`              | yes      | Updated by `TransactionSyncService` after every successful sync of this card, regardless of trigger (webhook/cron/manual). |

Plus one partial unique index so the same provider account can't be linked to
two different cards:

```
queryInterface.addIndex('Cards', ['provider', 'providerAccountId'], {
  unique: true,
  where: { providerAccountId: { [Op.ne]: null } },
  name: 'unique_provider_account_per_provider',
});
```

`down()` drops the index and the 9 columns.

**Why columns on `Cards` directly, not a `provider_connections` table:**
the user explicitly ruled out a join table for the card↔provider link, and a
personal app has at most a handful of cards, so the minor duplication if two
cards ever share one `providerConnectionId` (same encrypted token stored
twice) is a non-issue. Flagged in §13 as a decision made on your behalf in
case you'd rather normalize this later.

Update `src/models/card.ts`: add the 9 attributes above (camelCase, no
`field:` override, matching existing style) and extend the `Card` class with
the corresponding public properties (`provider?: string`,
`providerAccountId?: string`, etc.). Update `src/dto/card-dto.ts`
(`CardDTO`) with the same optional fields, but **never include the ciphertext
fields in `CardDTO`** — decryption only happens inside the sync/provider
layer, never on the read path exposed to adapters/resolvers.

### 3.2 New table: `staged_transactions`

Follows the newer convention (like `periods`): lowercase table name,
snake_case columns, `underscored: true` on the model.

New migration: `migrations/20260829010000-staged-transactions.cjs`

| Column                       | Type                | Nullable | Notes |
|-------------------------------|---------------------|----------|-------|
| `id`                           | `UUID` (PK, default uuidv4) | no | |
| `user_id`                      | `UUID`              | no | |
| `card_id`                      | `UUID`, FK → `"Cards".id`, `onDelete: 'CASCADE'` | no | |
| `provider`                     | `STRING`            | no | denormalized copy of `Cards.provider` at ingest time, so staged rows survive a card being unlinked/relinked and queries don't need a join just to filter by provider. |
| `provider_transaction_id`      | `STRING`            | no | External id from the provider. Used for idempotency. |
| `description`                  | `STRING`            | no | Raw merchant/description text as provider sent it. |
| `total`                        | `DECIMAL(12,2)`     | no | Same precision as `expenses.total`. |
| `transaction_date`             | `DATE`              | no | Date/time of the transaction per the provider. |
| `provider_pending`             | `BOOLEAN`, default `false` | no | Whether the bank itself still considers this pending (not yet posted). See §5.4 edge cases — pending transactions can be re-delivered with updated amounts before posting. |
| `review_status`                | `STRING`, default `'PENDING'` | no | App-level enum-as-string: `'PENDING' \| 'PROMOTED' \| 'DISMISSED'`. |
| `suggested_sub_category_id`    | `UUID`, FK → `sub_categories.id`, `onDelete: 'SET NULL'` | yes | |
| `suggested_period_id`          | `UUID`, FK → `periods.id`, `onDelete: 'SET NULL'` | yes | Read-only lookup at ingest time (§7.2) — never creates a period. |
| `suggestion_source`            | `STRING`            | yes | `'HISTORY_MATCH' \| 'NONE'` — see §7. |
| `promoted_expense_id`          | `UUID`, FK → `expenses.id`, `onDelete: 'SET NULL'` | yes | Set by `promoteStagedTransaction`. Doubles as the idempotency guard against double-promotion. |
| `raw_payload`                  | `JSONB`             | yes | Opaque copy of the provider's raw transaction object, for debugging/replay. Never deserialized outside `src/providers/**`. |
| `created_at` / `updated_at`    | `DATE`              | no | |

Constraint:

```
queryInterface.addConstraint('staged_transactions', {
  fields: ['card_id', 'provider_transaction_id'],
  type: 'unique',
  name: 'unique_staged_transaction_per_card',
});
```

This unique constraint is what makes ingestion idempotent: the sync service
always upserts on `(card_id, provider_transaction_id)` (`ON CONFLICT DO
UPDATE` semantics via Sequelize's `upsert`), so the same webhook delivered
twice, or a cron run overlapping a webhook, never creates duplicate staged
rows. It also lets a pending transaction (`provider_pending: true`) be
updated in place when the provider later reports it as posted with a
possibly-adjusted amount — as long as the provider keeps the same
`provider_transaction_id` across that transition (true for Teller; if a
future provider mints a new id when a transaction posts, that provider's
mapper is responsible for surfacing that as a normal new row — a
provider-specific concern that never leaks past `src/providers/**`).

New file `src/models/staged-transaction.ts`, registered in
`src/models/init-models.ts` and `src/models/associations.ts`
(`belongsTo Card as 'card'`, `belongsTo SubCategory as 'suggested_sub_category'`,
`belongsTo Period as 'suggested_period'`, `belongsTo Expense as 'promoted_expense'`).

New DTO `src/dto/staged-transaction-dto.ts` (`StagedTransactionDTO`).

### 3.3 Token encryption

New file: `src/security/token-cipher.ts` — two pure functions, no I/O:

```ts
export type EncryptedToken = {
  ciphertext: string; // base64
  iv: string;          // base64
  authTag: string;     // base64
};

export function encryptToken(plaintext: string): EncryptedToken;
export function decryptToken(input: EncryptedToken): string;
```

Implementation notes to hand to the implementor (not code, just the
contract): AES-256-GCM via Node's built-in `crypto`. Key comes from
`process.env.PROVIDER_TOKEN_ENCRYPTION_KEY`, a 32-byte key, base64-encoded in
the env var (so it can hold arbitrary bytes) — decoded once at module load.
A fresh random 12-byte IV is generated per call to `encryptToken`; it must
never be reused. Missing/malformed env var must throw at import time in
production (fail fast) — this mirrors how `process.env.BMX_TOKEN` is read
directly in `udi-client.ts`, so no new config-loading pattern is introduced.

This module is the only place in the codebase allowed to touch
`process.env.PROVIDER_TOKEN_ENCRYPTION_KEY`. Everything else (repository,
service) works with a plaintext access token in memory only for the duration
of a request/job and never logs it (explicit test case: logger calls in the
sync path must never include the token or ciphertext fields).

### 3.4 Rollout note (applies to both migrations)

Per existing repo convention, `pnpm migrate` is a manual step (there's no
`release_command` in `fly.toml` and `deploy:prod` does not run migrations).
Both migrations here are purely additive, so order relative to deploy
doesn't matter for safety, but `pnpm migrate` must still be run by hand
against production after the PR that introduces each migration is deployed,
same as every past migration in this repo.

## 4. Provider abstraction

New top-level module: `src/providers/` (parallel to `src/clients/`, but a
"provider" here is a swappable strategy behind a shared interface rather than
a single fixed client like `udi-client.ts`).

### 4.1 Shared contract — `src/providers/provider.types.ts`

```ts
export type ProviderName = 'teller';

export type ProviderTransaction = {
  providerTransactionId: string;
  providerAccountId: string;
  description: string;
  amount: number;        // positive = money out, same sign convention as Expense.total
  date: Date;
  pending: boolean;
  raw: unknown;
};

export type ProviderAccount = {
  providerAccountId: string;
  providerConnectionId: string;
  institutionName: string;
  last4?: string;
};

export type ProviderWebhookEvent =
  | { type: 'TRANSACTIONS_UPDATED'; providerAccountIds: string[] }
  | { type: 'CONNECTION_DISCONNECTED'; providerConnectionId: string }
  | { type: 'UNKNOWN'; raw: unknown };

export interface TransactionProvider {
  readonly name: ProviderName;
  listAccounts(accessToken: string): Promise<ProviderAccount[]>;
  listTransactions(input: {
    accessToken: string;
    providerAccountId: string;
    since?: Date;
  }): Promise<ProviderTransaction[]>;
  verifyWebhookSignature(input: {
    rawBody: string;
    headers: Record<string, string>;
  }): boolean;
  parseWebhookPayload(input: {
    rawBody: string;
    headers: Record<string, string>;
  }): ProviderWebhookEvent;
}
```

Nothing above the `src/providers/` boundary ever imports from
`src/providers/teller/`. Service/Repository/Resolver/Adapter code only
imports `TransactionProvider` and the generic types, plus
`getProvider(name)` from the registry below.

### 4.2 `src/providers/provider-registry.ts`

```ts
export function getProvider(name: ProviderName): TransactionProvider;
```

A simple lookup (`{ teller: tellerProvider }`) — this is the single seam a
second provider plugs into later.

### 4.3 Teller implementation — `src/providers/teller/`

- `teller-client.ts` — isolated low-level REST client, same shape as
  `src/clients/banxico/udi-client.ts`: an `axios.create()` instance, but with
  an `https.Agent` configured for **mTLS** (`cert`/`key` from
  `process.env.TELLER_CLIENT_CERT` / `process.env.TELLER_CLIENT_KEY`, PEM
  content held directly in Fly secrets — no filesystem cert path, so it works
  unmodified on ephemeral Fly Machines). Basic-auth uses the access token as
  the username per Teller's API convention. Exports raw, Teller-shaped
  functions only (`fetchAccounts(accessToken)`, `fetchTransactions(accessToken, accountId, since?)`).
  Nothing here is exported outside `src/providers/teller/`.
- `teller-mapper.ts` — pure functions translating Teller's raw JSON shapes
  into `ProviderAccount[]` / `ProviderTransaction[]` / `ProviderWebhookEvent`.
  This is where Teller's field names (`id`, `description`, `amount`,
  `date`, `status: 'posted'|'pending'`, `enrollment_id`, etc.) get translated
  once, in one place, into the generic vocabulary. Pure, no I/O — the easiest
  unit to test exhaustively.
- `teller-provider.ts` — implements `TransactionProvider`, composing
  `teller-client.ts` + `teller-mapper.ts`, plus webhook signature
  verification (Teller signs webhook deliveries; verify via the shared
  secret from `process.env.TELLER_SIGNING_SECRET` using the mechanism
  Teller's docs specify for the signature header — HMAC compare, timing-safe).

New env vars (direct `process.env.X` reads, no new config abstraction, per
existing `BMX_TOKEN` precedent): `TELLER_CLIENT_CERT`, `TELLER_CLIENT_KEY`,
`TELLER_SIGNING_SECRET`, `TELLER_ENVIRONMENT` (`sandbox`/`production`),
`PROVIDER_TOKEN_ENCRYPTION_KEY`.

### 4.4 Behaviors / test cases

- `teller-mapper`: posted transaction maps `pending: false`; a
  `status: 'pending'` Teller transaction maps `pending: true`; missing/odd
  fields (no description) map to an empty string, never throw; amount sign
  handling matches Teller's convention (Teller reports debits as negative —
  the mapper must invert so `ProviderTransaction.amount` is positive for
  money leaving the account, matching `Expense.total`); webhook payload for
  an unrecognized `type` maps to `{ type: 'UNKNOWN', raw }` rather than
  throwing.
- `teller-provider.verifyWebhookSignature`: valid signature → `true`;
  tampered body with valid-looking signature → `false`; missing signature
  header → `false`; never throws on malformed input.
- `teller-client`: constructs `https.Agent` with `cert`/`key` from env;
  missing cert/key envs throws a clear error at first use, not silently
  making an unauthenticated request.
- `provider-registry.getProvider('teller')` returns the Teller singleton;
  an unknown name throws (used by the webhook router to turn an unknown
  `:provider` path segment into a 404, see §5.2).

## 5. Sync mechanisms

All three mechanisms funnel into one shared service so there is exactly one
place that knows how to turn provider transactions into staged rows.

### 5.1 `TransactionSyncService` — `src/service/transaction-sync-service.ts`

```ts
class TransactionSyncService {
  constructor(userId: string, sequelize: Sequelize);

  async syncCard(cardId: string): Promise<{
    cardId: string;
    newTransactions: number;
    updatedTransactions: number;
    syncedAt: Date;
  }>;

  async syncAllLinkedCards(): Promise<Array<Awaited<ReturnType<TransactionSyncService['syncCard']>>>>;
}
```

`syncCard`:
1. Load the card (scoped by `userId`), fail if not found or not linked
   (`provider`/`providerAccessTokenCiphertext` null) — throws a clear error,
   not a silent no-op, so the manual mutation and cron job both surface it.
2. `decryptToken`, `getProvider(card.provider)`,
   `provider.listTransactions({ accessToken, providerAccountId: card.providerAccountId, since: card.providerLastSyncedAt })`.
   `since` is the previous sync watermark, keeping cron/manual calls cheap;
   the webhook path (already told which account changed) also goes through
   this same method.
3. For each `ProviderTransaction`: run `CategorySuggestionService` (§6) and a
   read-only `PeriodRepository.getPeriodBy({ date })` lookup, then upsert into
   `staged_transactions` keyed on `(cardId, providerTransactionId)`.
4. Update `card.providerLastSyncedAt` (and `providerStatus = 'ACTIVE'` on
   success, `'ERROR'` if the provider call failed — but the sync method
   itself still throws so the caller can decide how to surface the error).
5. Return counts (new vs. updated, based on whether the upsert inserted or
   modified a row).

`syncAllLinkedCards` iterates the user's cards where `provider` is not null,
calling `syncCard` for each and collecting results — a single card failing
must not abort the others (used by the manual "sync all" mutation and the
cron job); the aggregate result reports per-card success/failure.

**Behaviors / test cases:** unlinked card → throws; provider API error →
card marked `ERROR`, method rethrows, other cards in `syncAllLinkedCards`
still processed; re-syncing with no new transactions → `newTransactions: 0`;
a transaction already staged and since promoted is not touched by a later
poll that re-delivers it (its `review_status` stays `'PROMOTED'`, only
provider-supplied columns like `description`/`total`/`provider_pending`
would be refreshed by the upsert — see open question in §13 about whether a
promoted row should ever be touched again, current answer: **no**, the
upsert must not overwrite rows whose `review_status != 'PENDING'`); a
`provider_pending` transaction later delivered again as posted (same
`provider_transaction_id`) updates the existing staged row's amount/
`provider_pending` flag in place rather than creating a second row.

### 5.2 Webhook receiver

**Infrastructure change required, flagged explicitly:** `src/index.ts`
currently boots Apollo Server 4 via `startStandaloneServer`
(`@apollo/server/standalone`), which owns its own internal HTTP server and
has no supported way to attach an additional route — and Fly.io's
`fly.toml` here exposes exactly one `internal_port` (3000) for this app, so
a second listener isn't a clean option either. The standard fix, and
Apollo's own documented pattern for "GraphQL plus other routes", is to
switch to `expressMiddleware` from `@apollo/server/express4` mounted on a
plain `express` app, and add the webhook route on that same app/port.

New files:
- `src/http/app.ts` — builds the `express` app: `express.json()` +
  `expressMiddleware(apolloServer, { context })` mounted at `/graphql`
  (replicating the existing `context` function from `src/index.ts`
  unchanged), plus the webhook router mounted at `/webhooks`. `src/index.ts`
  changes to call `await apolloServer.start()` then
  `app.listen(port)` instead of `startStandaloneServer`.
- `src/http/webhook-router.ts` — an `express.Router()`:
  `POST /webhooks/:provider`.

New dependencies needed in `package.json`: `express`, `cors` (Apollo's
`expressMiddleware` needs both), `@types/express`, `@types/cors`.

Route behavior:
1. Body must be captured **raw** (`express.raw({ type: '*/*' })`) on this
   route specifically, before any JSON body-parsing middleware, because
   signature verification needs the exact bytes Teller signed — this must
   not share Express's global `express.json()` middleware, which would
   already have parsed/re-serialized (and mutated) the body.
2. `:provider` path param → `getProvider(name)`; unknown name → `404`
   (never throws past the router).
3. `provider.verifyWebhookSignature({ rawBody, headers })` → `false` → `401`,
   nothing processed, nothing logged at more than `warn` level (don't spam
   logs with what could be scanning traffic).
4. `provider.parseWebhookPayload(...)` → `ProviderWebhookEvent`.
   - `TRANSACTIONS_UPDATED`: resolve each `providerAccountId` to a `Card`
     (scoped query, no `userId` available from the webhook itself — this app
     has exactly one user, so "the card with this `providerAccountId`" is
     unambiguous; still written as a normal scoped repository lookup so nothing
     bypasses layering) and call `TransactionSyncService.syncCard`. An
     unmatched `providerAccountId` (e.g., a card that was unlinked) is logged
     at `warn` and skipped, not an error — the webhook still returns `200` so
     the provider doesn't retry forever.
   - `CONNECTION_DISCONNECTED`: mark the affected card(s)
     `providerStatus = 'DISCONNECTED'`. No sync attempted.
   - `UNKNOWN`: log at `info`, return `200` (ack and ignore — a forward-compatible
     event type from the provider shouldn't cause retries).
5. Respond `200` only after processing completes. A crash mid-processing
   means no ack, and the provider's own retry policy re-delivers — safe
   because ingestion is idempotent (§3.2).

**Behaviors / test cases:** valid signature + known account → staged rows
created/updated, `200`; invalid signature → `401`, no DB writes; unknown
`:provider` → `404`; valid payload, unlinked `providerAccountId` → `200`,
warning logged, no staged rows; same payload delivered twice → second
delivery does not create duplicate rows (relies on the same upsert path as
§5.1); a provider sync error inside the handler → `500`, so the provider
retries (this is the one path where a `500` is correct, unlike the
"unmatched account" case above).

### 5.3 Scheduled safety-net poll — recommendation

**Recommendation: a dedicated Fly Machine using Fly's native scheduled-machine
feature (`schedule: hourly`), running a one-shot script that exits, not an
in-process scheduler.**

Rationale: `fly.toml` already sets `auto_stop_machines = true` and
`min_machines_running = 0` — this app is deployed to scale to zero when
idle. An in-process `node-cron`-style scheduler only fires while the main
web machine happens to be running, which on a personal, low-traffic app
could mean the safety-net poll silently doesn't run for long stretches — and
making it reliable would mean setting `min_machines_running = 1`, i.e.
paying to keep a machine alive 24/7 purely so a timer can tick, which
defeats the point of scale-to-zero and is a worse trade than just running a
scheduled job. An external cron service (cron-job.org, GitHub Actions
schedule, etc.) hitting an HTTP endpoint was also considered and rejected:
it would require exposing an authenticated-but-not-JWT endpoint for a
third-party service to call, which is more moving parts (and more attack
surface) than using Fly's own primitive for exactly this use case.

Fly Machines' schedule granularity is coarse (`hourly` / `daily` / `monthly`
only — there's no arbitrary cron expression). **Hourly** is the right choice
here: the webhook is the near-real-time path, so this poll only needs to
catch what a missed/delayed webhook delivery would otherwise leave stale;
hourly is frequent enough for a personal-finance review workflow and cheap
(the machine starts, runs one sync pass across all linked cards, exits).

Concretely:
- New file `src/jobs/run-transaction-sync-job.ts` — a standalone entrypoint
  (same shape as `src/mcp/index.ts`): connects Sequelize, calls
  `initModels`/`associateModels` (same as `syncTables` does, but this job
  doesn't need `sequelize.sync()` — the schema is already migrated), loads
  the single app user's linked cards, calls
  `TransactionSyncService.syncAllLinkedCards()`, logs a summary, and calls
  `process.exit(0)` (non-zero on an unhandled failure, so a failed scheduled
  run is visible in Fly's machine logs/exit status).
- Compiled to `dist/src/jobs/run-transaction-sync-job.js` by the existing
  `pnpm build`/`tsc` pipeline — no new build step.
- Deployment: a second Fly Machine created from the same image
  (`fly machine run . --schedule hourly --entrypoint "node dist/src/jobs/run-transaction-sync-job.js"`,
  or the equivalent declared as a second `[processes]` entry in `fly.toml`
  with the schedule set via `flyctl machine update`/`machines run` — Fly's
  `schedule` is a machine-level property, not something `fly.toml`'s
  `[processes]` block itself declares, so this needs one manual
  `fly machine run`/`update` step documented in the PR, not something
  `fly deploy` alone reproduces). This is called out explicitly in §11 PR6
  as an operational step, not just a code change.

**Behaviors / test cases** (for the job script's internals, i.e.
`TransactionSyncService.syncAllLinkedCards`, already covered in §5.1 —
the job file itself is a thin wrapper and doesn't need its own unit tests
beyond confirming it calls the service and exits non-zero on throw, but a
manual "does it actually run on Fly's schedule" check belongs in the PR6
test/rollout plan, not automated tests).

### 5.4 Manual sync mutation

Thin: resolver → `TransactionSyncService.syncCard` or `syncAllLinkedCards`
depending on whether `cardId` was supplied. See §8 for the exact mutation
shape.

## 6. Auto-suggestion

New file: `src/service/category-suggestion-service.ts`.

```ts
class CategorySuggestionService {
  constructor(userId: string, sequelize: Sequelize);

  async suggestSubCategory(input: {
    cardId: string;
    description: string;
  }): Promise<{
    subCategoryId: string | null;
    source: 'HISTORY_MATCH' | 'NONE';
  }>;
}
```

Heuristic (deliberately simple — personal-scale, no ML/embeddings, per the
user's explicit instruction):

1. Normalize the incoming `description`: lowercase, strip punctuation,
   split into tokens, drop tokens shorter than 4 characters (drops noise
   like "the", "inc", card-network filler).
2. Pull the user's most recent N (e.g. 200) `Expense` rows via
   `ExpenseRepository`, most recent first (this repository already exists
   and already scopes by `userId`; add a method rather than duplicating the
   query). Same normalization on each historical `concept`.
3. For each historical expense, score = size of the token-set intersection
   with the incoming description. Keep the subset scoring `> 0`.
4. Among the matches, pick the `subCategoryId` that appears most often
   (mode); ties broken by most recent `payBefore`. Confidence is not stored
   as a number (kept out of the schema to avoid over-promising precision the
   heuristic can't back up) — instead `suggestion_source` just records
   `'HISTORY_MATCH'` so the UI can show "suggested from history" vs. no
   suggestion at all.
5. No match → `{ subCategoryId: null, source: 'NONE' }`.

This intentionally does **not** implement a maintained keyword→subcategory
map as a first pass — flagged as a gap-fill decision in §13, since the user
mentioned it as one acceptable option. Reasoning: history-matching is
zero-maintenance (it improves automatically as the user promotes more
transactions) whereas a keyword map is a new thing the user has to curate;
starting with history-matching and adding a manual override table later if
it proves insufficient is the smaller first cut.

**Period suggestion** is not a separate service — it's a direct, read-only
`PeriodRepository.getPeriodBy({ date: transactionDate })` call from
`TransactionSyncService` at ingest time (§5.1 step 3). It intentionally uses
`getPeriodBy`, not `createPeriod`: a staged transaction that's never promoted
should not have caused a `Period` row to be created as a side effect. If no
period exists yet for that date, `suggested_period_id` stays `null` until
promotion, where the full get-or-create (`createPeriod`) from
`createFixedExpenses` runs (§7).

**Behaviors / test cases:** description with no history → `NONE`/`null`;
one clear historical match → returns its subcategory,
`source: 'HISTORY_MATCH'`; two historical subcategories tied on score →
mode-then-recency tiebreak is deterministic (test with a constructed tie);
matching is card-agnostic by design (a "Costco" charge should suggest the
same subcategory regardless of which card it was on) — confirmed as a
behavior, not left ambiguous, because merchants aren't tied to one card;
case/punctuation differences between historical `concept` and incoming
`description` still match (e.g. "AMAZON.COM*1AB23" vs "Amazon").

## 7. GraphQL schema additions

All additions to `schema.graphql`; run `pnpm codegen` after.

```graphql
enum TransactionProviderName {
  TELLER
}

enum ProviderConnectionStatus {
  ACTIVE
  DISCONNECTED
  ERROR
}

enum TransactionReviewStatus {
  PENDING
  PROMOTED
  DISMISSED
}

type StagedTransaction {
  id: ID!
  card: Card!
  description: String!
  total: String!
  transactionDate: String!
  providerPending: Boolean!
  reviewStatus: TransactionReviewStatus!
  suggestedSubCategory: SubCategory
  suggestedPeriod: Period
  promotedExpense: Expense
  createdAt: String
  updatedAt: String
}

type TransactionSyncResult {
  cardId: ID!
  newTransactions: Int!
  updatedTransactions: Int!
  syncedAt: String!
  error: String
}

input StagedTransactionsFilterInput {
  cardId: ID
  reviewStatus: TransactionReviewStatus
}

input LinkCardToProviderInput {
  cardId: ID!
  provider: TransactionProviderName!
  providerAccountId: String!
  providerConnectionId: String!
  accessToken: String!
}

input SyncTransactionsInput {
  cardId: ID
}

input PromoteStagedTransactionInput {
  stagedTransactionId: ID!
  categoryId: String!
  subCategoryId: String!
  concept: String
  total: Float
  payBefore: Date
  comment: String
}

extend type Card {
  provider: TransactionProviderName
  providerStatus: ProviderConnectionStatus
  providerLinkedAt: String
  providerLastSyncedAt: String
}

extend type Query {
  stagedTransactions(input: StagedTransactionsFilterInput): [StagedTransaction!]!
  stagedTransactionById(id: ID!): StagedTransaction
}

extend type Mutation {
  linkCardToProvider(input: LinkCardToProviderInput!): Card!
  unlinkCardFromProvider(cardId: ID!): Card!
  syncTransactions(input: SyncTransactionsInput): [TransactionSyncResult!]!
  promoteStagedTransaction(input: PromoteStagedTransactionInput!): Expense!
  dismissStagedTransaction(id: ID!): StagedTransaction!
}
```

(`schema.graphql` doesn't currently use `extend type` anywhere — everything
is one flat file — so in practice the implementor should just add these
fields directly into the existing `type Card`, `type Query`, `type Mutation`
blocks rather than literally writing `extend type`, to match the file's
existing style. Shown as `extend` here only to make clear these are
*additions* to existing types, not replacements.)

Notes on the input/type choices:
- `LinkCardToProviderInput.accessToken` is the raw token the frontend gets
  back from the Teller Connect widget after the user finishes linking an
  account. It travels over GraphQL exactly once, gets encrypted immediately
  in the resolver→service path, and is never echoed back — `Card` never
  exposes token fields, ciphertext included.
- `PromoteStagedTransactionInput` deliberately omits `periodId` and `cardId`:
  the card is already fixed (it's the staged transaction's card), and the
  period is always resolved server-side via the same get-or-create logic
  `createFixedExpenses` uses (§8.1) — the whole point of staging is that the
  user doesn't have to know or pick a period. `categoryId`/`subCategoryId`
  are required inputs (matching `CreateExpenseInput`'s shape) because the
  suggestion is only a suggestion — the user can accept or override it in
  the review UI, and the mutation makes no assumption about which one
  happened. `concept`/`total`/`payBefore`/`comment` are optional overrides
  that default to the staged transaction's own `description`/`total`/
  `transactionDate` when omitted, so accepting a suggestion as-is is a
  minimal-input call.
- `dismissStagedTransaction` is a distinct mutation from promote rather than
  a status field on some generic "update" mutation, matching this repo's
  existing pattern of one narrow mutation per action (`deleteExpense`,
  `deleteCard`, etc. are similarly single-purpose).

## 8. Promote-to-Expense flow (detail)

New service method, alongside `CategorySuggestionService`, on a new
`TransactionStagingService` (`src/service/transaction-staging-service.ts`) —
kept separate from `TransactionSyncService` because promotion/dismissal is a
different concern (review-time actions on already-staged rows) from
ingestion:

```ts
class TransactionStagingService {
  constructor(userId: string, sequelize: Sequelize);

  async listStaged(filter: { cardId?: string; reviewStatus?: string }): Promise<StagedTransactionDTO[]>;
  async getById(id: string): Promise<StagedTransactionDTO | null>;
  async promote(input: {
    stagedTransactionId: string;
    categoryId: string;
    subCategoryId: string;
    concept?: string;
    total?: number;
    payBefore?: Date;
    comment?: string;
  }): Promise<ExpenseDTO>;
  async dismiss(id: string): Promise<StagedTransactionDTO>;
}
```

`promote`, modeled directly on `ExpensesService.createFixedExpenses`
(`src/service/expenses-service.ts:183`):

1. Open a single Sequelize transaction (`this.sequelize.transaction()`),
   same as `createFixedExpenses` and `updateExpense`.
2. Load the staged transaction (scoped by `userId`), inside the transaction.
   Not found → throw. `review_status !== 'PENDING'` → throw (no
   re-promoting an already-`PROMOTED` or `DISMISSED` row — this is the
   idempotency guard for double-clicks/retries on the mutation).
3. Resolve the target date: `payBefore` override if given, else the staged
   transaction's `transaction_date`.
4. Resolve the period exactly like `createFixedExpenses` does per occurrence:
   `PeriodRepository.getPeriodBy({ date }, { transaction })`; if none,
   `PeriodRepository.createPeriod(date, { transaction })`. Same
   get-or-create call, not a re-implementation.
5. `ExpenseRepository.createExpense({ concept, total, cardId: stagedTransaction.cardId, periodId, categoryId, subCategoryId, comments, payBefore: date }, { transaction })`
   — `concept`/`total`/`comment` default to the staged row's
   `description`/`total`/`null` when not overridden.
6. Update the staged row in the same transaction:
   `review_status = 'PROMOTED'`, `promoted_expense_id = expense.id`.
7. Commit; on any failure, rollback (mirrors `createFixedExpenses`'
   try/catch/rollback exactly) and rethrow.

`dismiss`: no transaction needed (single-row update) —
`review_status = 'DISMISSED'` where `review_status = 'PENDING'`; dismissing
an already-`PROMOTED`/`DISMISSED` row throws (same idempotency guard as
promote).

**Behaviors / test cases:**
- Promoting a `PENDING` staged transaction with an existing matching period
  → `Expense` created with that `periodId`, staged row updated, single
  commit (mirror the `createFixedExpenses` "creates X expenses" test style
  from `test/src/service/expenses-service.spec.ts`).
- Promoting when no period exists yet for that date → `createPeriod` called
  once, `Expense.periodId` matches the newly created period (mirrors the
  existing "creates periods when none exist for a target date" test).
- `ExpenseRepository.createExpense` throwing (e.g. FK violation on a bad
  `subCategoryId`) → transaction rolled back, staged row's `review_status`
  unchanged (still `PENDING`), matching the existing "rolls back on error"
  test.
- Promoting an already-`PROMOTED` row → throws, no second `Expense` created,
  no transaction opened unnecessarily (this check should happen before
  opening the transaction, or immediately inside it before any writes).
- Promoting a nonexistent/other-user's `stagedTransactionId` → throws, same
  "not found" shape as `getExpenseByPK` elsewhere.
- Override fields (`concept`, `total`, `payBefore`, `comment`) each
  independently override their corresponding staged-row default when
  supplied, and fall back correctly when omitted — test each field alone
  and all together.
- `dismiss` on a `PENDING` row → `review_status: 'DISMISSED'`,
  `promoted_expense_id` stays `null`.
- `dismiss` on an already-`PROMOTED`/`DISMISSED` row → throws.

New resolver files (per the "Adding a New Mutation" recipe in `agent.md`):
- `src/resolvers/mutation/card/link-card-to-provider.ts`
- `src/resolvers/mutation/card/unlink-card-from-provider.ts`
- `src/resolvers/mutation/transaction/sync-transactions.ts`
- `src/resolvers/mutation/transaction/promote-staged-transaction.ts`
- `src/resolvers/mutation/transaction/dismiss-staged-transaction.ts`
- `src/resolvers/query/transaction/staged-transactions.ts`
- `src/resolvers/query/transaction/staged-transaction-by-id.ts`

All thin: extract `userId`/`sequelizeClient` from context, construct the
relevant service, delegate, adapt the result. Registered in
`src/resolvers/mutation.ts` / `src/resolvers/queries.ts` and their respective
`index.ts` barrels, each wrapped in `withErrorHandling`, exactly like every
existing resolver.

New adapter: `src/adapters/staged-transaction-adapter.ts`
(`adaptStagedTransactionDTO`). Existing `adaptCard`
(`src/adapters/income-adapter.ts:144`) and/or `adaptCardDTO`
(`src/adapters/card-adapter.ts`) get the 4 new provider-facing fields added
(never the ciphertext fields — see §3.1). Provider name mapping from the DB's
lowercase `'teller'` to the GraphQL enum's `TELLER` is done via an explicit
small lookup map in the adapter, not `.toUpperCase()`, so it doesn't silently
"work by accident" for a future multi-word provider id.

## 9. New files / modules summary

| Path | Responsibility |
|---|---|
| `migrations/20260829000000-cards-provider-link.cjs` | Additive columns + unique index on `"Cards"` |
| `migrations/20260829010000-staged-transactions.cjs` | New `staged_transactions` table |
| `src/models/staged-transaction.ts` | Sequelize model + associations |
| `src/dto/staged-transaction-dto.ts` | `StagedTransactionDTO` |
| `src/security/token-cipher.ts` | AES-256-GCM encrypt/decrypt of provider tokens |
| `src/providers/provider.types.ts` | `TransactionProvider` interface + generic types |
| `src/providers/provider-registry.ts` | `getProvider(name)` |
| `src/providers/teller/teller-client.ts` | mTLS REST calls to Teller, Teller-shaped I/O only |
| `src/providers/teller/teller-mapper.ts` | Teller JSON → generic types |
| `src/providers/teller/teller-provider.ts` | `TransactionProvider` impl for Teller |
| `src/repository/staged-transaction-repository.ts` | CRUD + idempotent upsert for staged rows |
| `src/service/transaction-sync-service.ts` | Orchestrates provider pull → staging, shared by all 3 triggers |
| `src/service/transaction-staging-service.ts` | List/promote/dismiss staged rows |
| `src/service/category-suggestion-service.ts` | History-based subcategory suggestion |
| `src/adapters/staged-transaction-adapter.ts` | `StagedTransactionDTO` → GraphQL `StagedTransaction` |
| `src/http/app.ts` | Express app: mounts Apollo + webhook router (replaces `startStandaloneServer`) |
| `src/http/webhook-router.ts` | `POST /webhooks/:provider` |
| `src/jobs/run-transaction-sync-job.ts` | One-shot entrypoint for the scheduled Fly Machine |
| `src/resolvers/mutation/card/link-card-to-provider.ts` | |
| `src/resolvers/mutation/card/unlink-card-from-provider.ts` | |
| `src/resolvers/mutation/transaction/sync-transactions.ts` | |
| `src/resolvers/mutation/transaction/promote-staged-transaction.ts` | |
| `src/resolvers/mutation/transaction/dismiss-staged-transaction.ts` | |
| `src/resolvers/query/transaction/staged-transactions.ts` | |
| `src/resolvers/query/transaction/staged-transaction-by-id.ts` | |

Modified files: `src/models/card.ts`, `src/dto/card-dto.ts`,
`src/models/init-models.ts`, `src/models/associations.ts`,
`src/adapters/income-adapter.ts` / `src/adapters/card-adapter.ts`,
`src/repository/card-repository.ts` (add
`findLinkedCards(userId)`/`linkProvider(...)`/`unlinkProvider(...)`/
`updateProviderSyncMetadata(...)`), `src/repository/expense-repository.ts`
(add the history-lookup method `CategorySuggestionService` needs, e.g.
`getRecentExpensesForSuggestion(userId, limit)`), `src/index.ts` (Express
migration), `schema.graphql`, `package.json` (new deps), `fly.toml`
(document the second scheduled machine), `.env`/Fly secrets (new vars listed
in §4.3 and §3.3).

Possible future extension, not part of this design: MCP tools for staging
(`src/mcp/tools/staged-transaction-tools.ts`) so an AI agent could list/
promote staged transactions the same way it already manages expenses —
natural fit given `src/mcp/` mirrors the domain, but left out of this PR
sequence since the user only asked it be noted.

## 10. PR sequence

1. **PR1 — Data foundations.** `Cards` migration, `staged_transactions`
   migration, `StagedTransaction` model, `Card` model/DTO updates,
   `token-cipher.ts`, `provider.types.ts` (interface only, no
   implementation). *Rationale: everything else needs the schema and the
   shared type contract to exist; this PR has no external HTTP calls, so
   it's fully unit-testable in isolation and safe to land first.*
2. **PR2 — Teller provider + link/unlink.** `teller-client.ts`,
   `teller-mapper.ts`, `teller-provider.ts`, `provider-registry.ts`,
   `linkCardToProvider`/`unlinkCardFromProvider` mutations + schema. *No
   syncing happens yet — this PR only proves a card can be connected and its
   token stored encrypted. Depends on PR1's columns/types; isolated behind
   mocked HTTP in tests.*
3. **PR3 — Manual sync + staging read path.** `staged-transaction-repository.ts`,
   `transaction-sync-service.ts`, `category-suggestion-service.ts`,
   `syncTransactions` mutation, `stagedTransactions`/`stagedTransactionById`
   queries. *This is the core domain logic and the first PR that produces
   user-visible value end to end (connect → manual sync → see staged
   transactions with suggestions). Depends on PR2's provider interface being
   real.*
4. **PR4 — Promote / dismiss.** `transaction-staging-service.ts`,
   `promoteStagedTransaction`/`dismissStagedTransaction` mutations. *Closes
   the loop into real `Expense` rows. Kept separate from PR3 because it
   touches `Expense` creation and reuses/extends the
   `createFixedExpenses`-style transactional logic — deserves isolated
   review and its own focused test suite rather than being bundled into the
   already-large PR3.*
5. **PR5 — Webhook receiver.** Express migration (`src/http/app.ts`,
   updated `src/index.ts`), `webhook-router.ts`, new `express`/`cors` deps.
   *Infra-sensitive (changes how the server boots) — isolated from the pure
   domain-logic PRs on purpose, so a bootstrap regression is easy to bisect
   to one PR. Depends on `TransactionSyncService` from PR3.*
6. **PR6 — Scheduled safety-net poll.** `run-transaction-sync-job.ts`,
   `fly.toml`/deployment doc updates, the one-time `fly machine run
   --schedule hourly` operational step. *Purely additive and lowest-risk;
   sequenced last so the manual and webhook paths are already proven before
   adding a third, less-observable trigger for the same code path.*

## 11. Test plan outline (by component)

- **`token-cipher`**: round-trip encrypt→decrypt returns original plaintext;
  two encryptions of the same plaintext produce different ciphertext/IV
  (never reused IV); tampered ciphertext or auth tag fails to decrypt
  (throws, doesn't silently return garbage); missing/malformed encryption
  key env var throws at load.
- **Migrations**: `up()` on a copy of the current schema succeeds and is
  additive-only (no existing column altered/dropped); `down()` cleanly
  reverses; the `Cards` unique index rejects linking a second card to the
  same `(provider, providerAccountId)`; `staged_transactions`' unique
  constraint rejects a duplicate `(card_id, provider_transaction_id)` insert.
- **`teller-mapper`**: see §4.4.
- **`teller-provider.verifyWebhookSignature`**: see §4.4.
- **`provider-registry`**: see §4.4.
- **`CardRepository` provider methods**: link sets all 8 columns correctly
  and encrypts the token (assert the stored value isn't the plaintext);
  unlink clears provider fields but leaves the card's core fields
  (`bank`/`alias`/etc.) untouched; scoped by `userId` (linking/unlinking
  another user's card fails) — even though single-user today, this mirrors
  every other repository's scoping and should be tested the same way.
- **`StagedTransactionRepository`**: upsert inserts a new row on first call,
  updates in place on a repeat call with the same `(cardId,
  providerTransactionId)`; upsert never overwrites a row whose
  `review_status != 'PENDING'` (see §5.1); `findByFilter` respects
  `cardId`/`reviewStatus` filters and always scopes by `userId`.
- **`TransactionSyncService`**: see §5.1 behaviors list in full.
- **`CategorySuggestionService`**: see §6 behaviors list in full.
- **`TransactionStagingService` (promote/dismiss)**: see §8 behaviors list
  in full — written in the same mocked-repository style as
  `test/src/service/expenses-service.spec.ts`'s `createFixedExpenses` suite
  (mock `periodRepository`/`expenseRepository`/`stagedTransactionRepository`,
  assert transaction commit/rollback calls).
- **Webhook router** (`src/http/webhook-router.ts`, tested with a real
  `express` app + `supertest`-style request, or Vitest + a manually
  constructed request/response if `supertest` isn't already a dependency —
  flagged as a new dev dependency to add): see §5.2 behaviors list in full.
- **Resolvers**: thin — each resolver test just asserts it extracts
  `userId`/`sequelizeClient` from context and delegates to the right service
  method with the right arguments, consistent with how existing resolvers
  are (not) tested today (no existing resolver has a dedicated spec file —
  this repo's test coverage today is repository/service-level; keep new
  resolver coverage proportionate, i.e. optional, and put the real assertions
  in the service tests).
- **`run-transaction-sync-job.ts`**: not unit-tested beyond confirming it
  calls `TransactionSyncService.syncAllLinkedCards` and exits non-zero on an
  unhandled rejection; actual scheduled execution is verified manually on
  Fly per PR6's rollout notes, not via Vitest.

## 12. Gap-fill decisions made in this document (flag for review)

These weren't explicitly specified by you and were filled in to keep the
design concrete — worth a second look before implementation starts:

1. **Token/connection fields live directly on `Cards`**, including
   duplicating the encrypted token if two cards ever shared one Teller
   enrollment, rather than a separate `provider_connections` reference
   table. Chosen for simplicity at personal-app scale and because you ruled
   out a join table for the card↔provider link; a reference table isn't a
   join table so it was still an option, just not the one taken.
2. **Status/enum-like DB columns (`providerStatus`, `review_status`,
   `suggestion_source`) are plain `STRING`, not Postgres `ENUM` types** —
   to avoid the `ALTER TYPE ... ADD VALUE` friction if these need new values
   later. GraphQL-level enums still exist for API safety.
3. **Auto-suggestion uses history-matching only, not a maintained
   keyword→subcategory map** — you offered both as acceptable; history-
   matching was picked as the zero-maintenance starting point.
4. **Webhook processing is synchronous, in the request handler, no queue** —
   consistent with "no job/queue infra exists today" and the personal scale
   of the data, but means a slow provider API call during a webhook delivery
   holds that HTTP request open; acceptable at this volume, worth
   revisiting if Teller ever pushes large transaction batches per webhook.
5. **Cron mechanism: a second Fly Machine on a native schedule, not
   in-process `node-cron`** — directly driven by the existing
   `auto_stop_machines`/`min_machines_running: 0` config; flagged because it
   also means one manual `flyctl` step per deploy of PR6 that isn't captured
   by `fly deploy` alone (see §5.3).
6. **`src/index.ts` moves from `startStandaloneServer` to `expressMiddleware`
   + `express`** — this is a real change to how the server boots, not purely
   additive, and is the one part of this design that touches
   already-working, unrelated-to-this-feature code. Isolated into its own
   PR (PR5) for exactly that reason.
7. **Six PRs instead of five** — split "manual sync" (PR3) from
   "promote/dismiss" (PR4) rather than shipping them together, since
   promotion is the one place this feature writes to the existing
   `Expense`/`Period` tables and seemed worth its own isolated review.
