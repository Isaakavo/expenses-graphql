# Design: Credit Card Transaction Staging & Auto-Import

Status: draft for review. Phase 1 (schema, token cipher, provider interface)
and Phase 2 (a full Teller.io provider implementation) have already been
built — see **§0 Provider note: Teller → Plaid** immediately below for what
changed and why the rest of this document now describes Plaid instead of
Teller.

## 0. Provider note: Teller → Plaid (course correction)

The original plan (Phase 2, committed on a branch that will not ship) built a
full Teller.io provider: `src/providers/teller/` (`teller-client.ts`,
`teller-mapper.ts`, `teller-provider.ts`) plus `linkCardToProvider` /
`unlinkCardFromProvider` mutations wired to it. That work is **not
abandoned as evidence** — it proved the `TransactionProvider` abstraction
correctly isolates provider-specific code from
Service/Repository/Resolver/Adapter/GraphQL layers — but Teller has become
unavailable for new signups, so it will not ship. The Teller code remains in
git history for reference only; nothing in `src/providers/teller/` is part
of the design described below.

**Branch state:** the Teller Phase 2 commit lives on
`feature/auto-detect-transactions-phase-2-teller-provider`, which is not
merged and should not be. The integration branch
`feature/auto-detect-transactions` contains Phase 1 only and has no Teller
code in it, so all Plaid work branches cleanly from there. Nothing needs to
be reverted or deleted; the Teller branch is simply left unmerged.

The replacement is **Plaid**, specifically Plaid's **Trial plan** (free,
auto-approved, no business registration required, up to 10 Production
Items). This choice was already made outside this document — what follows is
the technical design of the Plaid provider implementation, which every
section below (§1, §2, §3.5, §4, §5.2, §7, §9, §10) has been rewritten
around. Sections not about the provider itself — §3.1–§3.4 (Phase 1 schema,
already merged), §5.1's outer contract, §5.3, §6, §8 — are provider-agnostic
and are called out explicitly where they needed no change.

**A structural mismatch worth stating up front:** Teller's model was one
access token per account, fetched per-account with a `since` date filter.
Plaid's model is per-**Item** (one login/connection to an institution,
covering potentially several accounts) with a **cursor-based** sync endpoint
that returns changes across all of an Item's accounts in one call. This
doesn't fit the Phase 1 `TransactionProvider.listTransactions` signature at
all, so that already-merged interface changes as part of this course
correction — see §4.1, marked clearly as a breaking change to shipped code.

## 1. Goal / Summary

Today every `Expense` is entered by hand. This feature connects the user's
credit cards (Bank of America, Chase, Wells Fargo, via **Plaid**, Trial
plan) so transactions are detected automatically, land in a new **staging
area** (`staged_transactions`), arrive pre-populated with a suggested
`SubCategory` and `Period`, and can be reviewed and **promoted** into a real
`Expense` with one mutation. Detection happens through three complementary
paths: a webhook (near real-time), a scheduled poll (safety net), and a
manual "sync now" mutation.

The codebase must not become coupled to Plaid: everything above the
`src/providers/plaid/` folder talks only to a generic `TransactionProvider`
interface. Swapping or adding a provider later should not touch
Service/Repository/Resolver/Adapter/GraphQL code.

This is a single-user app; there is no multi-tenant/billing complexity to
design for. All new server-side code still scopes every query by `userId`
per existing convention, and all new resolvers still go through
`x-session-key` JWT auth like every other resolver.

### Out of scope
- Bank-to-account reconciliation / balance tracking (Plaid exposes balances
  via `/accounts/balance/get`, we don't use them here).
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
createProviderLinkToken mutation ──► POST /link/token/create
        │                              (server-side; registers the webhook URL
        │                               with Plaid for this Item)
        │  link_token
        ▼
Plaid Link (frontend widget)
        │  public_token (+ metadata: every selected account's account_id)
        ▼
linkCardToProvider mutation ──► exchange public_token for access_token/item_id
                                 (via TransactionProvider.exchangeToken)
                             ──► one or more Card rows get provider_* columns
                                 (same encrypted token duplicated per card)
                             ──► provider_connections row find-or-created for
                                 (provider, providerConnectionId), holding the
                                 shared sync cursor for that Item

Plaid webhook (item-scoped) ──► POST /webhooks/:provider ──┐
Fly Machine cron (hourly) ──► run-transaction-sync-job.ts ──┤──► TransactionSyncService
syncTransactions mutation ───────────────────────────────────┘         │
                                                                        ▼
                                            TransactionProvider.listTransactions()
                                            (PlaidProvider; one /transactions/sync
                                             call per Item, cursor-based, returns
                                             every sibling account's changes)
                                                                        │
                                                map → generic ProviderTransaction[],
                                                bucketed per Card by providerAccountId
                                                                        │
                                                    CategorySuggestionService (subCategory)
                                                    PeriodRepository.getPeriodBy (period, read-only)
                                                                        │
                                                                        ▼
                                        staged_transactions (upsert, idempotent, per sibling card)
                                        provider_connections.sync_cursor updated once, same transaction
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
| `provider`                       | `STRING`            | yes      | e.g. `'plaid'`. Lowercase, provider-defined string, not a Postgres ENUM (see rationale below). |
| `providerAccountId`               | `STRING`            | yes      | The provider's id for this specific account (Plaid: `account_id`). |
| `providerConnectionId`            | `STRING`            | yes      | The provider's id for the auth/enrollment this account belongs to (Plaid: `item_id`). Not unique per card — one connection can cover multiple accounts/cards; this is the normal case for Plaid (e.g. a checking account and a credit card from the same bank login are one Item). See §3.5 for where the shared per-Item sync cursor lives. |
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
twice) is a non-issue. Flagged in §12 as a decision made on your behalf in
case you'd rather normalize this later. (This course correction does add a
`provider_connections` table in §3.5 — but it's not the card↔provider join
table considered and rejected here; it exists solely to hold the shared,
frequently-mutated Plaid sync cursor, a problem that didn't exist when this
paragraph was written for Teller. The token itself stays exactly where this
paragraph puts it, still duplicated per card. See §3.5's opening paragraph
for why the cursor's mutability is what forced a different answer than the
token's.)

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
| `provider_pending`             | `BOOLEAN`, default `false` | no | Whether the bank itself still considers this pending (not yet posted). See §5.1 — pending transactions can be re-delivered with updated amounts before posting. |
| `review_status`                | `STRING`, default `'PENDING'` | no | App-level enum-as-string: `'PENDING' \| 'PROMOTED' \| 'DISMISSED'`. |
| `suggested_sub_category_id`    | `UUID`, FK → `sub_categories.id`, `onDelete: 'SET NULL'` | yes | |
| `suggested_period_id`          | `UUID`, FK → `periods.id`, `onDelete: 'SET NULL'` | yes | Read-only lookup at ingest time (§6) — never creates a period. |
| `suggestion_source`            | `STRING`            | yes | `'HISTORY_MATCH' \| 'NONE'` — see §6. |
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
possibly-adjusted amount — **as long as the provider keeps the same
`provider_transaction_id` across that transition**. This assumption does
**not** hold for Plaid the way it held for Teller: Plaid's documented
behavior (recalled from general familiarity with the API, not verified
against current docs — flagged here explicitly, confirm before
implementing) is that a pending transaction and its posted counterpart are
**two different `transaction_id` values**, linked by a `pending_transaction_id`
field on the posted transaction that points back at the original pending
id. A naive upsert keyed only on the current id would therefore insert a
second staged row when a transaction posts, instead of updating the pending
one in place. §4.1 adds an optional `pendingTransactionId` field to
`ProviderTransaction` for exactly this, and §5.1 describes the reconciliation
step: when a transaction carries `pendingTransactionId`, the sync service
upserts by looking up the *existing* staged row under the old id first and
updates its `provider_transaction_id` in place, rather than always upserting
under the incoming id. If Plaid's real behavior turns out to preserve the
same id across pending→posted (i.e. matches Teller's model after all), this
reconciliation step is simply a no-op — `pendingTransactionId` stays absent
and the existing simple upsert-by-current-id path handles it, so the design
is safe either way. Any future provider's mapper is responsible for
populating (or omitting) `pendingTransactionId` correctly — a
provider-specific concern that never leaks past `src/providers/**` beyond
this one optional field.

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

### 3.4 Rollout note (applies to all migrations in this section, including §3.5)

Per existing repo convention, `pnpm migrate` is a manual step (there's no
`release_command` in `fly.toml` and `deploy:prod` does not run migrations).
All migrations in this section are purely additive, so order relative to
deploy doesn't matter for safety, but `pnpm migrate` must still be run by
hand against production after the PR that introduces each migration is
deployed, same as every past migration in this repo.

### 3.5 New table: `provider_connections` — added by this course correction

Not part of Phase 1. This table exists because of the Teller→Plaid switch
(see §0): Plaid's `/transactions/sync` cursor is scoped to the **Item**
(`providerConnectionId`), not the account, and one Item can back multiple
`Cards` (§3.1 already documents this — "Not unique per card"). The cursor is
mutated on every single sync, unlike the access token (written once at link
time and never touched again). Storing high-churn mutable state duplicated
across sibling `Cards` rows — as §3.1's already-merged design does for the
token — would mean two cards racing to read-modify-write "the same" cursor
independently, which is exactly how you get lost updates, duplicate staged
rows, or dropped transactions under Plaid's cursor semantics (see §5.1 for
the full mechanics). This table exists purely to give that shared, mutable,
per-connection state one unambiguous home. It is deliberately **not** a
card↔provider join table — §3.1's decision to keep the link itself directly
on `Cards`, duplicated per card when a connection is shared, is unaffected
and unchanged; only the cursor moves out.

New migration: `migrations/20260829020000-provider-connections.cjs` —
purely additive, new table, does not modify the already-merged
`migrations/20260829000000-cards-provider-link.cjs` or
`migrations/20260829010000-staged-transactions.cjs` in any way.

| Column                    | Type                | Nullable | Notes |
|----------------------------|---------------------|----------|-------|
| `id`                       | `UUID` (PK, default uuidv4) | no | |
| `user_id`                  | `UUID`              | no | Scoped like every other table in this design; single-user app today, kept consistent with existing convention regardless. |
| `provider`                 | `STRING`            | no | e.g. `'plaid'`. |
| `provider_connection_id`   | `STRING`            | no | Plaid's `item_id`. |
| `sync_cursor`              | `TEXT`              | yes | Plaid's `next_cursor` from the last successful `/transactions/sync` call. `null` means "never synced" — the first call for a new connection passes `cursor: null`, which is Plaid's documented convention for an initial sync. |
| `created_at` / `updated_at` | `DATE`             | no | `updated_at` doubles as "last successful sync time" for this connection — no separate `last_synced_at` column; it would only ever change in lockstep with `sync_cursor`, so a second column would be redundant with what `updated_at` already gives for free. |

Constraint:

```
queryInterface.addConstraint('provider_connections', {
  fields: ['provider', 'provider_connection_id'],
  type: 'unique',
  name: 'unique_provider_connection',
});
```

New file `src/models/provider-connection.ts`, `underscored: true`, following
the newer table convention like `staged_transactions` (§3.2), registered in
`src/models/init-models.ts`. **No Sequelize association to `Card`** —
consistent with §3.1's decision not to model the card↔provider link as a
join table, `Cards.providerConnectionId` is a plain string, not a foreign
key, so the repository layer does explicit
`where: { provider, providerConnectionId }` lookups instead of an ORM
association.

New file `src/repository/provider-connection-repository.ts`:
`findOrCreate({ userId, provider, providerConnectionId }, { transaction })`
(used by `linkCardToProvider`, idempotent — reused as-is when a second card
links into the same Item) and
`updateCursor({ id, cursor }, { transaction })`. `TransactionSyncService`
(§5.1) additionally needs to read the row **with a row lock**
(`SELECT ... FOR UPDATE`, i.e. Sequelize's `lock: transaction.LOCK.UPDATE`)
before reading `sync_cursor`, to serialize two sibling cards' syncs that
happen to race (webhook + cron overlapping, or two cards under one Item both
triggered by the same Item-scoped webhook) — see §5.1 for why an unlocked
read-modify-write on this row is unsafe.

Unlinking a card (`unlinkCardFromProvider`) does **not** delete its
`provider_connections` row, even if it was the last card referencing that
connection — an orphaned row is inert (just a cached cursor with nothing
using it), consistent with how `staged_transactions` rows already survive a
card being unlinked (§3.2). Deleting it on unlink would only add complexity
(checking whether any sibling card still references the connection) for no
real benefit at personal-app scale.

**Cursor reset when a card joins an existing connection.** §5.1 step 6
drops transactions belonging to accounts under the Item that aren't tracked
as `Card` rows, while the cursor advances past them permanently. If a card
is later added for one of those previously-untracked accounts (a savings
account the user decides to start tracking, or a second card linked into an
already-linked Item), a plain incremental sync would never deliver that
account's earlier transactions — they are behind the cursor and Plaid will
not re-send them. So `linkCardToProvider` must, when it links a card into a
`provider_connections` row that **already exists**, reset that row's
`sync_cursor` to `null`, forcing the next sync to re-fetch the connection's
full history. This is safe rather than destructive: staging ingestion is
idempotent by `(card_id, provider_transaction_id)` (§3.2) and never
overwrites rows whose `review_status != 'PENDING'` (§5.1), so a full
re-sync re-confirms existing rows and adds the newly-tracked account's
history without disturbing anything the user already reviewed. Repository
method: `resetCursor({ id }, { transaction })`, or equivalently
`updateCursor` called with `null`.

## 4. Provider abstraction

New top-level module: `src/providers/` (parallel to `src/clients/`, but a
"provider" here is a swappable strategy behind a shared interface rather than
a single fixed client like `udi-client.ts`).

### 4.1 Shared contract — `src/providers/provider.types.ts`

**This is a breaking change to already-merged Phase 1 code.** The Implementor
edits `src/providers/provider.types.ts` in place — the shape below replaces
the current file, it is not additive. Nothing has consumed this interface
yet (Phase 3, `TransactionSyncService`, is unimplemented; the only Phase 2
consumer was the Teller provider, which isn't shipping), so there is no
runtime code to migrate — but flagging this as a breaking change matters
because the *type* was previously reviewed/merged as-is and is being
reshaped, not extended.

What changed and why, one at a time:

- **`listTransactions` is now connection-scoped and cursor-based, not
  account-scoped and date-based.** Teller's shape (`providerAccountId`,
  `since: Date`) has no honest mapping to Plaid's `/transactions/sync`,
  which operates on the whole Item and returns a `next_cursor` instead of
  accepting a date. Trying to preserve the old signature and fake a `since`
  parameter internally (option (a) considered and rejected — see the
  reasoning at the top of §5.1) creates a real correctness bug, not just an
  inefficiency: whichever card's sync call runs second under a shared Item
  would silently see an empty result and miss transactions that arrived in
  the first call's response, because the cursor can only advance once per
  underlying Plaid call. So `listTransactions` now takes a `cursor` instead
  of `providerAccountId`/`since`, and returns all changed transactions
  across every account under the connection in one shot — bucketing per
  `Card` is now `TransactionSyncService`'s job, not the provider's,
  using `ProviderTransaction.providerAccountId` (unchanged, already
  present per-transaction).
- **`ProviderTransaction` gains an optional `pendingTransactionId`** — see
  the note in §3.2 on why Plaid's pending→posted transition likely changes
  `transaction_id` rather than keeping it stable, unlike Teller. Optional,
  so providers that don't need it (or if this Plaid assumption turns out
  wrong) simply omit it and get the old simple-upsert behavior for free.
- **`ProviderWebhookEvent`'s `TRANSACTIONS_UPDATED` variant now carries a
  single `providerConnectionId` instead of `providerAccountIds: string[]`**
  — Plaid webhooks are Item-scoped (`item_id`), there is no per-account
  webhook to report a list of affected accounts for.
- **`verifyWebhookSignature` and `parseWebhookPayload` are now `async`.**
  Teller's HMAC check was pure/synchronous. Plaid's JWT verification needs
  the signing key for the JWT's `kid`, fetched (and cached) from
  `/webhook_verification_key/get` — genuine I/O. This also ripples into
  §5.2 (the webhook router must now `await` both calls).
- **`ProviderName` is `'plaid'`, not `'teller' | 'plaid'`.** Teller isn't
  shipping (§0); keeping a dead literal in the union buys nothing and would
  need cleanup later anyway.
- **New optional `exchangeToken` method**, to model Plaid's link flow
  honestly: Teller Connect hands the frontend a directly-usable access
  token; Plaid Link hands the frontend a short-lived `public_token` that
  must be exchanged server-side for an `access_token` **and** an `item_id`
  via `/item/public_token/exchange` before anything can be stored. Rather
  than forcing every provider through an exchange step it may not need,
  this is optional on the interface — `linkCardToProvider`'s service logic
  (§7) checks for it and calls it when present, otherwise treats the raw
  input as an already-usable access token (Teller's case, preserved for
  documentation purposes even though no Teller code ships).
- **New optional `createLinkSession` method**, to model the step that has to
  happen *before* the frontend can open the provider's link widget at all.
  Teller Connect needed nothing from our server — the frontend opened the
  widget with a public application id and immediately got back a usable
  token, which is why the pre-Plaid draft of this document had no such
  concept. Plaid Link cannot open without a **`link_token`** minted
  server-side by `POST /link/token/create`, and that call is also the only
  place Plaid is told **which webhook URL to notify for this Item**. Without
  it there is no Link widget and no webhooks at all, so §5.2's receiver
  would sit waiting for deliveries that are never sent. Optional on the
  interface for the same reason `exchangeToken` is: a provider that needs no
  server-minted session simply omits it, and the resolver (§7) skips the
  step.

```ts
export type ProviderName = 'plaid';

export type ProviderTransaction = {
  providerTransactionId: string;
  providerAccountId: string;
  description: string;
  amount: number;        // positive = money out, same sign convention as Expense.total
  date: Date;
  pending: boolean;
  pendingTransactionId?: string; // set when this transaction supersedes an earlier pending one with a different id — see §3.2
  raw: unknown;
};

export type ProviderAccount = {
  providerAccountId: string;
  providerConnectionId: string;
  institutionName: string;
  last4?: string;
};

export type ProviderTransactionSyncResult = {
  transactions: ProviderTransaction[]; // Plaid's added + modified, merged — both are upserts to the sync service (see §5.1)
  removedProviderTransactionIds: string[];
  nextCursor: string;
  hasMore: boolean; // Plaid paginates a single sync burst; caller loops while true, persisting nextCursor only once, after the loop
};

export type ProviderWebhookEvent =
  | { type: 'TRANSACTIONS_UPDATED'; providerConnectionId: string }
  | { type: 'CONNECTION_DISCONNECTED'; providerConnectionId: string }
  | { type: 'UNKNOWN'; raw: unknown };

export interface TransactionProvider {
  readonly name: ProviderName;
  listAccounts(accessToken: string): Promise<ProviderAccount[]>;
  createLinkSession?(input: { userId: string }): Promise<{ linkToken: string }>;
  exchangeToken?(rawToken: string): Promise<{
    accessToken: string;
    providerConnectionId: string;
  }>;
  listTransactions(input: {
    accessToken: string;
    cursor: string | null;
  }): Promise<ProviderTransactionSyncResult>;
  verifyWebhookSignature(input: {
    rawBody: string;
    headers: Record<string, string>;
  }): Promise<boolean>;
  parseWebhookPayload(input: {
    rawBody: string;
    headers: Record<string, string>;
  }): Promise<ProviderWebhookEvent>;
}
```

Nothing above the `src/providers/` boundary ever imports from
`src/providers/plaid/`. Service/Repository/Resolver/Adapter code only
imports `TransactionProvider` and the generic types, plus
`getProvider(name)` from the registry below.

### 4.2 `src/providers/provider-registry.ts`

```ts
export function getProvider(name: ProviderName): TransactionProvider;
```

A simple lookup (`{ plaid: plaidProvider }`) — this is the single seam a
second provider plugs into later.

### 4.3 Plaid implementation — `src/providers/plaid/`

**Confidence note up front:** the method and field names below are drawn
from general familiarity with Plaid's API, not a live docs fetch — this
session had no web access to Plaid's current reference. They are plausible
and internally consistent but were never verified. **This risk is now
largely handled by using the official `plaid` SDK** (see the dependency
note at the end of this section): its types are generated from Plaid's
OpenAPI spec, so a wrong method or field name below becomes a TypeScript
compile error during implementation rather than a runtime surprise. Where
this section names an SDK method or request field, treat it as a strong
hint whose exact spelling `tsc` will confirm or correct — not as something
to take on faith, but not as something needing manual doc cross-checking
either. What the SDK cannot check for you is *semantics*: which
`webhook_code` values should count as a disconnect, and the sign/pending
conventions, still need judgement (§4.4, §12b).

- `src/providers/plaid/plaid-client.ts` — thin wrapper around the **official
  `plaid` npm SDK**, not a hand-rolled REST client. This is a deliberate
  departure from the `src/clients/banxico/udi-client.ts` precedent (and from
  the unshipped `teller-client.ts`), decided after the first draft — see the
  dependency note below for the full rationale. The wrapper still exists
  rather than calling the SDK directly from `plaid-provider.ts`, so that the
  SDK's surface stays confined to one file and the mapper/provider keep
  working against a small, stable set of functions.

  Construction: `new PlaidApi(new Configuration({ basePath: PlaidEnvironments[env], baseOptions: { headers: { 'PLAID-CLIENT-ID': ..., 'PLAID-SECRET': ... }, timeout: 10000 } }))`.
  Notes on that:
  - The SDK handles credential placement itself — do not hand-build request
    bodies containing `client_id`/`secret`.
  - `env` comes from `PLAID_ENV`. **Plaid retired the standalone
    `development` environment, so `PLAID_ENV` takes `sandbox` or
    `production` only** — do not build a three-way branch. Validate the
    value against `PlaidEnvironments` and throw on an unrecognized one
    rather than defaulting to production.
  - The SDK is axios-based underneath, so `baseOptions.timeout` is how the
    mandatory timeout gets set. This is not optional politeness — §5.1 holds
    a database row lock across these calls, so an untimed hung request would
    hold that lock indefinitely.
  - Build the client lazily on first use (not at module import) so that
    missing `PLAID_CLIENT_ID`/`PLAID_SECRET` throws at call time and the
    test suite does not require real Plaid credentials just to import the
    module. This mirrors what the Teller client did and is the reason its
    tests could run credential-free.

  Exported functions, each a one-line delegation to an SDK method, returning
  the SDK's typed response and nothing else re-exported outside this folder:
  - `createLinkToken(userId: string)` → `linkTokenCreate({ user: { client_user_id: userId }, client_name, products: [Products.Transactions], country_codes: [CountryCode.Us], language: 'en', webhook: process.env.PLAID_WEBHOOK_URL })`. The `webhook` field is what registers §5.2's receiver URL with Plaid for the resulting Item — omit it and no webhook is ever delivered.
  - `exchangePublicToken(publicToken: string)` → `itemPublicTokenExchange({ public_token: publicToken })`.
  - `getAccounts(accessToken: string)` → `accountsGet({ access_token: accessToken })`.
  - `syncTransactions(accessToken: string, cursor: string | null)` → `transactionsSync({ access_token: accessToken, cursor: cursor ?? undefined })` (Plaid's convention: an absent cursor means "initial sync"; pass `undefined`, not `null` or `''`).
  - `getWebhookVerificationKey(keyId: string)` → `webhookVerificationKeyGet({ key_id: keyId })`, which returns a JWK, not a PEM.
- `src/providers/plaid/plaid-mapper.ts` — pure functions translating Plaid's
  raw JSON into the generic types, same role as (unshipped) `teller-mapper.ts`:
  - `mapAccount(raw)` → `ProviderAccount` (`account_id` → `providerAccountId`, `item_id` → `providerConnectionId`, institution name from the accompanying `item`/institution lookup, `mask` → `last4`).
  - `mapTransaction(raw)` → `ProviderTransaction`. **Amount sign: no
    inversion.** This is the one place a Teller-shaped assumption would be
    an actual bug if copied over: Teller reports debits as negative and the
    (unshipped) Teller mapper had to invert. **Plaid already reports
    positive amounts for money leaving the account** — the same convention
    `ProviderTransaction.amount`/`Expense.total` already use — so
    `mapTransaction` passes `raw.amount` through unchanged. `pending` maps
    directly from `raw.pending`. `pendingTransactionId` maps directly from
    `raw.pending_transaction_id` when present (only expected on
    already-posted transactions that supersede an earlier pending one — see
    §3.2). `description` prefers `raw.merchant_name`, falling back to
    `raw.name`, falling back to `''` — never throws on a missing/odd field,
    matching the Teller mapper's existing robustness bar.
  - `mapSyncResult(raw)` → `ProviderTransactionSyncResult`: `added` and
    `modified` are concatenated into one `transactions` array (both cases
    are upserts as far as the sync service is concerned — see §5.1 — so the
    mapper doesn't need to distinguish them any further than Plaid already
    has), `removed[].transaction_id` → `removedProviderTransactionIds`,
    `next_cursor` → `nextCursor`, `has_more` → `hasMore`.
  - `mapWebhookPayload(claims)` → `ProviderWebhookEvent`, from the already
    JWT-verified claims (see `plaid-provider.ts` below): `webhook_type:
    'TRANSACTIONS'` + `webhook_code: 'SYNC_UPDATES_AVAILABLE'` (and likely
    other transaction-related codes — confirm the full set) →
    `{ type: 'TRANSACTIONS_UPDATED', providerConnectionId: claims.item_id }`;
    `webhook_type: 'ITEM'` + a disconnect-shaped `webhook_code` (e.g.
    `PENDING_EXPIRATION`/`ERROR`/`USER_PERMISSION_REVOKED` — Plaid has
    several Item-error codes, confirm which map to "treat as disconnected"
    at implementation time) → `{ type: 'CONNECTION_DISCONNECTED',
    providerConnectionId: claims.item_id }`; anything else →
    `{ type: 'UNKNOWN', raw: claims }`.
- `src/providers/plaid/plaid-provider.ts` — implements `TransactionProvider`,
  composing `plaid-client.ts` + `plaid-mapper.ts`:
  - `createLinkSession({ userId })` calls `createLinkToken`, returns
    `{ linkToken: response.link_token }`. Nothing is persisted — the token
    is short-lived (Plaid expires it in hours) and single-use for opening
    the widget, so it is minted fresh per link attempt and handed straight
    back to the frontend.
  - `exchangeToken(publicToken)` calls `exchangePublicToken`, returns
    `{ accessToken: response.access_token, providerConnectionId: response.item_id }`.
  - `listTransactions({ accessToken, cursor })` calls `syncTransactions`
    once and maps the result via `mapSyncResult`. It does **not** loop on
    `hasMore` itself — that loop lives in `TransactionSyncService` (§5.1),
    since persisting the cursor is a service-level concern (needs a DB
    transaction) that the provider layer has no business doing; the
    provider stays a thin, stateless translator of one HTTP call per
    invocation, consistent with how Teller's provider was scoped.
  - Webhook verification owns a small in-memory cache,
    `Map<string, JWK>` keyed by `kid`, populated lazily via
    `getWebhookVerificationKey` and never expired within process lifetime.
    **Resolved since the first draft: no TTL is needed.** Plaid rotates
    verification keys by issuing a *new* `kid`, not by changing the key
    behind an existing one, so a cache keyed on `kid` cannot go stale — a
    rotated-in key simply arrives as a cache miss and is fetched on demand,
    and the superseded entry becomes inert rather than wrong. Uses
    the `jose` library (new dependency — see below) rather than
    `jsonwebtoken` + a separate JWK→PEM conversion package, since `jose` can
    verify a JWT directly against a JWK without a PEM round-trip:
    1. Decode the JWT header only (no verification yet) to read `kid`.
    2. Look up `kid` in the cache; on a miss, call
       `getWebhookVerificationKey(kid)` and cache the returned JWK.
    3. `jose.jwtVerify(token, importedJwk)` — verifies the signature and
       standard claims (`exp`, etc.); throws on failure.
    4. Additionally verify body integrity: compute SHA-256 of the raw
       webhook body and compare against the verified payload's
       `request_body_sha256` claim (Plaid's documented mechanism, as best
       recalled, for binding the JWT to this exact body even though the
       body itself isn't embedded in the token — reconfirm the claim name).
    `verifyWebhookSignature` returns `true`/`false` based on whether steps
    1–4 all succeed, never throwing past its own boundary (catches and
    returns `false`), matching the Teller-era contract's behavior even
    though the mechanism is completely different. `parseWebhookPayload`
    re-decodes and re-verifies (simplest correct thing; a request-scoped
    memoization of the decoded claims, keyed by `rawBody`, is a reasonable
    internal optimization since §5.2's router always calls
    `verifyWebhookSignature` immediately before `parseWebhookPayload` on the
    same request — not required for correctness, left as an implementation
    detail).

New env vars (direct `process.env.X` reads, no new config abstraction, per
existing `BMX_TOKEN` precedent): `PLAID_CLIENT_ID`, `PLAID_SECRET`,
`PLAID_ENV` (`sandbox` or `production` — see above), `PLAID_WEBHOOK_URL`
(the public URL of §5.2's receiver, e.g.
`https://<fly-app>.fly.dev/webhooks/plaid`; passed to
`/link/token/create` and therefore required before any webhook can ever be
delivered — note this means webhooks cannot be exercised against a local
dev server without a tunnel such as ngrok, since Plaid must be able to
reach the URL from the public internet),
`PROVIDER_TOKEN_ENCRYPTION_KEY` (unchanged from Phase 1, §3.3). **No
`PLAID_WEBHOOK_SIGNING_SECRET`-style static secret** — unlike Teller, Plaid
webhook verification uses the rotating keys fetched at runtime, not a value
held in an env var, which is worth calling out since it's an easy thing to
instinctively add and then never use.

New dependencies: **`plaid`** (the official SDK) and `jose` (JWT/JWK
verification — the SDK fetches the verification key but does not verify
JWTs, so `jose` is still needed).

**Decision reversed from the first draft: use the official `plaid` SDK.**
The first draft hand-rolled a REST client to stay consistent with this
repo's existing thin-client pattern (`udi-client.ts`), and flagged the SDK
as worth reconsidering. Reconsidered, and the SDK wins, for one reason that
outweighs the consistency argument: **the hand-rolled client is exactly
where this design's unverified-shape risk concentrates.** Every request and
response shape in §4.3 was written from general familiarity with Plaid's
API, not from live docs, and a hand-rolled client would push each of those
guesses into runtime — a wrong field name surfaces as a silent `undefined`
or a 400 from Plaid, discovered during manual testing at best. The SDK's
types are generated from Plaid's OpenAPI spec, so the same mistakes become
compile errors instead. That converts the largest remaining risk in this
design from "hope the field names are right" into something `tsc` checks.

Costs, accepted knowingly: a heavier dependency than anything else in
`src/providers/`, and a calling convention that differs from
`udi-client.ts`. Both are contained by keeping `plaid-client.ts` as a thin
wrapper — the SDK's types and methods do not leak past that file, so the
mapper, provider, and everything above the provider boundary are unchanged
by this decision, and a future provider is still free to hand-roll its
client. Note the SDK does **not** change any of the design's actual
mechanics: the cursor semantics (§5.1), the amount sign convention (§4.4),
the Item-vs-account scoping (§3.5), and the webhook JWT flow are all
properties of Plaid's API, not of how we call it.

### 4.4 Behaviors / test cases

- `plaid-mapper.mapTransaction`: a transaction with `pending: false` maps
  `pending: false`; `pending: true` maps `pending: true`; **amount passes
  through unchanged, no sign inversion** (explicit regression test — this
  is the opposite convention from Teller and the single easiest thing to
  get wrong by copying the Teller mapper's pattern); `pending_transaction_id`
  present → `pendingTransactionId` set to that value; absent → `undefined`,
  not `null`/`''`; missing `merchant_name` falls back to `name`; both
  missing → `description: ''`, never throws.
- `plaid-mapper.mapSyncResult`: `added` and `modified` both end up in
  `transactions` (test that a `modified`-only response still produces
  non-empty `transactions`, not just `added`); `removed` maps to
  `removedProviderTransactionIds` by `transaction_id`; `has_more: true` →
  `hasMore: true`; `next_cursor` passed through verbatim; empty
  `added`/`modified`/`removed` → `{ transactions: [], removedProviderTransactionIds: [] }`, not an error.
- `plaid-mapper.mapWebhookPayload`: `TRANSACTIONS`/`SYNC_UPDATES_AVAILABLE`
  claims → `{ type: 'TRANSACTIONS_UPDATED', providerConnectionId }`; an
  Item-error claim recognized as a disconnect →
  `{ type: 'CONNECTION_DISCONNECTED', providerConnectionId }`; an
  unrecognized `webhook_type`/`webhook_code` combination →
  `{ type: 'UNKNOWN', raw: claims }`, never throws.
- `plaid-provider.createLinkSession`: returns the `link_token` from the
  client response; asserts the outgoing `/link/token/create` body carries a
  non-empty `webhook` field taken from `PLAID_WEBHOOK_URL` (regression test
  — a missing `webhook` silently disables every webhook for that Item, with
  no error at link time and no symptom until transactions quietly fail to
  arrive) and `products: ['transactions']`; a Plaid error response
  propagates as a thrown error.
- `plaid-provider.exchangeToken`: valid `public_token` → returns
  `{ accessToken, providerConnectionId }` read straight from the exchange
  response; a Plaid error response (e.g. an already-used/expired
  `public_token`) propagates as a thrown error, not a silently-empty
  result — the resolver (§7) needs to surface link failures to the user.
- `plaid-provider.listTransactions`: one `syncTransactions` call maps
  straight through `mapSyncResult`; a `null` cursor is passed through as-is
  on first sync (not coerced to `''` or omitted); does not itself loop on
  `hasMore` (assert it makes exactly one client call per invocation — the
  looping behavior belongs to `TransactionSyncService`, tested in §5.1).
- `plaid-provider.verifyWebhookSignature`: valid JWT signed by a currently
  cached key → `true`; valid JWT whose `kid` isn't cached → fetches via
  `getWebhookVerificationKey`, caches it, then verifies → `true` (assert
  exactly one fetch call, and that a second verification with the same
  `kid` doesn't re-fetch); tampered payload with an otherwise well-formed
  JWT → `false`; JWT whose `request_body_sha256` claim doesn't match the
  actual raw body (body tampered in transit after signing, or wrong body
  passed in) → `false`; malformed/non-JWT `rawBody`/header → `false`, never
  throws.
- `plaid-client`: missing `PLAID_CLIENT_ID`/`PLAID_SECRET` throws a clear
  error at first use, not silently making an unauthenticated request
  (mirrors the Teller-era `teller-client` requirement for its own
  credentials, §4.4 predecessor); the SDK `Configuration` is built with an
  explicit `baseOptions.timeout` (assert it is set and non-zero — an untimed
  request would hold §5.1's row lock indefinitely); `PLAID_ENV` selects the
  `sandbox` vs `production` entry from `PlaidEnvironments`, and an
  unrecognized value throws rather than defaulting to production. Tests mock
  the SDK's `PlaidApi` methods (e.g. `vi.mock('plaid')`) rather than mocking
  axios — the wrapper's job is delegation, so the assertions are about which
  SDK method is called with which arguments.
- `provider-registry.getProvider('plaid')` returns the Plaid singleton; an
  unknown name throws (used by the webhook router to turn an unknown
  `:provider` path segment into a 404, see §5.2).

## 5. Sync mechanisms

All three mechanisms funnel into one shared service so there is exactly one
place that knows how to turn provider transactions into staged rows.

### 5.1 `TransactionSyncService` — `src/service/transaction-sync-service.ts`

**How this reconciles Plaid's Item-scoped, cursor-based sync with a
`Card`-centric design, and why:** three options were weighed.

- **(a) Keep the Phase 1 `listTransactions` shape (per-account, date-based),
  have `PlaidProvider` internally call `/transactions/sync` once per Item
  and filter to the requested account, accepting redundant calls when cards
  share an Item.** Rejected — not because of the redundant-call cost (that
  part would be fine at this scale) but because it's not actually
  implementable correctly. A cursor can only be advanced once per real
  Plaid call. If `syncCard` for card A calls `/transactions/sync`, gets back
  changes for both A's and sibling card B's accounts, keeps only A's slice,
  and persists the advanced cursor — then when `syncCard` runs for card B
  (moments later, or on the next cron pass), it would call
  `/transactions/sync` again with the now-already-advanced cursor and get
  back an **empty** delta, because B's transactions were already consumed
  and discarded in A's call. B's new transactions would be silently lost,
  not just redundantly fetched. This isn't a corner case — a checking
  account and a credit card from the same bank login sharing one Item is
  exactly the scenario named in the task, and it would be silently broken
  by option (a).
- **(b) Change the generic `TransactionProvider` interface to be
  cursor-based and Item-aware, and change `TransactionSyncService` to
  operate at the connection level, with `syncCard` as a thin per-card view
  over that.** Chosen — see §4.1 for exactly what changed in
  `provider.types.ts` and why it's a breaking (but currently
  zero-blast-radius, since nothing consumes the interface yet) change to
  already-merged Phase 1 code.
- **(c) Something else** — e.g. giving up on a shared cursor and instead
  tracking a per-`(card, since-date)` watermark by filtering Plaid's sync
  response client-side by date instead of using the cursor's own
  incremental semantics at all. Rejected: this throws away the entire point
  of a sync cursor (correct, complete incremental delivery including
  `removed` transactions) in favor of re-deriving a weaker, Teller-shaped
  approximation, for no benefit — it doesn't avoid the interface change
  anyway, since `since: Date` still isn't what `/transactions/sync` wants as
  input.

The fix is at two levels: the **provider interface** (§4.1, done) and the
**service**, below. `syncCard(cardId)`'s outer contract — signature and
return shape — is unchanged from the pre-existing §5.1 (kept stable per the
task's steer), but its internals, and a documented side effect, change:

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

`syncCard(cardId)` now delegates to an internal, un-exported
`syncConnection(providerConnectionId, userId)` that does the real work once
per Item, and slices out the requested card's counts from the result:

1. Load the card (scoped by `userId`), fail if not found or not linked
   (`provider`/`providerAccessTokenCiphertext` null) — throws a clear error,
   not a silent no-op, so the manual mutation and cron job both surface it.
2. Load every **sibling card** for this user sharing
   `(card.provider, card.providerConnectionId)` — this is the full set of
   cards that will actually get synced by this call, not just `cardId`.
3. Open a Sequelize transaction. Inside it, load the connection's
   `provider_connections` row **with a row lock**
   (`lock: transaction.LOCK.UPDATE`) by `(provider, providerConnectionId)`
   — this is what makes two overlapping syncs of the same connection (e.g.
   a webhook and the hourly cron landing close together, or two sibling
   cards both triggered by one Item-scoped webhook) safe: the second caller
   blocks until the first commits, then reads the *already-advanced*
   cursor, rather than both reading the same stale cursor and racing to
   write conflicting "next" cursors. `findOrCreate` if somehow missing
   (defensive — `linkCardToProvider`, §7, is expected to have already
   created it). **Accepted tradeoff, stated explicitly:** this lock (and the
   pooled DB connection holding it) is held across step 5's external HTTP
   calls to Plaid, which is normally something to avoid. It is accepted here
   because the alternative — releasing the lock between pages and
   reacquiring it to write — reintroduces exactly the interleaving the lock
   exists to prevent, and because at single-user scale there is no
   contention to speak of and the pool is nowhere near exhaustion. What
   makes it tolerable rather than merely convenient is the mandatory axios
   timeout on every Plaid call (§4.3): the lock's worst-case hold time is
   bounded by `timeout × pages`, not unbounded. If this feature ever grows
   past one user, revisit before anything else in this design.
4. `decryptToken` (any sibling card's ciphertext — they're duplicates of the
   same token per §3.1/§12), `getProvider(card.provider)`.
5. Loop: `provider.listTransactions({ accessToken, cursor: connection.syncCursor })`;
   accumulate `transactions`/`removedProviderTransactionIds` across
   iterations; repeat while the last result's `hasMore` is `true`, passing
   the just-returned `nextCursor` into the next call. Stop, keeping the
   final `nextCursor` to persist once.
6. Bucket the accumulated `ProviderTransaction[]` by `providerAccountId`
   against the sibling cards loaded in step 2. A transaction whose
   `providerAccountId` doesn't match **any** of the user's cards (e.g. a
   savings account under the same Item that was never added as a tracked
   `Card`) is silently dropped — not staged, not logged as an error, since
   this app only tracks the accounts the user has explicitly turned into
   `Card` rows, not everything Plaid happens to return for the Item.
7. For each sibling card's bucket, and for each `ProviderTransaction`: run
   `CategorySuggestionService` (§6) and a read-only
   `PeriodRepository.getPeriodBy({ date })` lookup, then upsert into
   `staged_transactions` keyed on `(cardId, providerTransactionId)` — same
   upsert semantics as before (§3.2), including the "never overwrite a row
   whose `review_status != 'PENDING'`" rule. **Reconciliation for
   `pendingTransactionId`:** if a `ProviderTransaction` carries
   `pendingTransactionId`, first look up an existing staged row by
   `(cardId, provider_transaction_id = pendingTransactionId)`. Three cases,
   and the middle one is the one an earlier draft of this section got wrong
   by folding it into "not found":
   - **Found, `review_status = 'PENDING'`:** update that row in place —
     including overwriting its `provider_transaction_id` to the new posted
     id, plus amount, `provider_pending: false`, description — instead of
     inserting a new row. This is the normal pending-becomes-posted path.
   - **Found, `review_status = 'PROMOTED'` or `'DISMISSED'`:** the user
     already reviewed this transaction while it was pending. Do **not**
     update it as above — that would violate the never-overwrite-reviewed
     rule stated two sentences earlier in this same step. But do **not**
     insert a new row either: that would resurface a transaction the user
     has already dealt with, as a duplicate. Instead update **only**
     `provider_transaction_id` (to the new posted id) and
     `provider_pending` (to `false`), leaving `review_status`,
     `promoted_expense_id`, amounts, and suggestions untouched. The point
     of that narrow update is purely identity bookkeeping: it lets every
     future re-delivery of this transaction match the existing row instead
     of inserting a fresh duplicate. Any amount change between pending and
     posted on an already-promoted transaction is deliberately *not*
     propagated to the `Expense` — silently rewriting a reviewed expense
     behind the user's back is worse than a small stale amount, and there
     is no UI in this design for surfacing such a correction.
   - **Not found** (the pending version was never staged at all, e.g. the
     card was linked between the pending and posted deliveries): normal
     insert under the new id.
   If `pendingTransactionId` is absent, behavior is exactly the pre-existing
   simple upsert.
8. Process `removedProviderTransactionIds`: for each, find the
   `staged_transactions` row by `provider_transaction_id`, scoped to the
   sibling cards' ids and `review_status = 'PENDING'` (a removed
   already-promoted/dismissed row is left untouched, same non-overwrite
   principle as step 7), and delete it — Plaid's `removed` array means the
   transaction was retracted (e.g. a duplicate the bank corrected, or a
   pending transaction that never posted), not "mark as removed" but an
   actual delete, since a retracted transaction should never have been
   shown to the user in the first place, unlike a posted/pending state
   transition. Note: this lookup does **not** depend on whether Plaid's
   `removed` entries carry an `account_id` field (unconfirmed either way,
   see §4.3) — it scopes by the sibling-card set instead, which is
   sufficient.
9. On success: update every sibling card's `providerLastSyncedAt` and
   `providerStatus = 'ACTIVE'`, and the connection's `sync_cursor` to the
   final `nextCursor`, all in the same transaction as steps 7–8. Commit.

   **Failure path — do not fold this into the same transaction.** An earlier
   draft of this step said to write `providerStatus = 'ERROR'` "in the same
   transaction as steps 7–8", which cannot work: if the provider call
   failed, that transaction is rolled back, and the rollback discards the
   ERROR marker along with everything else, leaving the card looking
   untouched. So on failure: roll back the sync transaction first, then
   write `providerStatus = 'ERROR'` for the connection's cards in a
   **separate, committed transaction**, then rethrow so the caller (manual
   mutation, webhook route, cron job) decides how to surface it. Explicit
   test: after a provider failure, the card's persisted `providerStatus` is
   `'ERROR'` and no staged rows from the failed attempt survive.
10. Return per-card counts for **every** sibling card synced (new vs.
    updated, based on whether each upsert inserted or modified a row), so
    `syncCard(cardId)` can slice out just the requested card's entry to
    satisfy its stable return type.

**Documented behavior change from the pre-Plaid design:** calling
`syncCard(cardId)` for one card now has the side effect of also syncing and
updating `staged_transactions` for any sibling cards sharing its Item — this
is intentional and unavoidable given Plaid's Item-scoped cursor, not an
accidental leak. `syncAllLinkedCards` should take advantage of this rather
than fight it: **group the user's linked cards by
`(provider, providerConnectionId)` first, call the internal
`syncConnection` once per unique connection**, and assemble the returned
array (one entry per card, matching the existing documented return type)
from each connection's per-card results — this avoids the wasted redundant
`/transactions/sync` call a naive per-card loop would otherwise make for
every additional sibling card under the same Item. (A naive per-card loop
would still be *correct*, just wasteful — because step 3's row lock and the
cursor-driven "second call sees an already-advanced cursor and gets an
empty delta" behavior make it safe, just not free.)

**Behaviors / test cases:** unlinked card → throws; provider API error →
card's **persisted** `providerStatus` is `'ERROR'` after the sync
transaction rolled back (the separate-transaction requirement in step 9 —
this test fails if the ERROR write is folded into the rolled-back
transaction), method rethrows, other cards/connections in
`syncAllLinkedCards` still processed; re-syncing with no new transactions →
`newTransactions: 0`; a transaction already staged and since promoted is not
touched by a later poll that re-delivers it (its `review_status` stays
`'PROMOTED'` — the upsert must not overwrite rows whose
`review_status != 'PENDING'`); `hasMore: true` on the first `syncTransactions`
call causes a second call with the intermediate `nextCursor` before the
service considers the sync done, and only the *final* cursor is persisted
(not the intermediate one — a crash between the first and second page would
leave `sync_cursor` unadvanced, which is safe/idempotent, versus persisting
an intermediate cursor and then crashing, which would lose the second page's
worth of transactions forever); **two sibling cards under one connection:**
`syncCard(cardA)` stages transactions for both `cardA` and `cardB`'s
accounts in one pass, `provider_connections.sync_cursor` is written exactly
once, and a subsequent `syncCard(cardB)` call in the same test makes a real
API call (asserting the design doesn't try to be clever and skip it) but
receives an empty delta and results in `newTransactions: 0` for `cardB`
(because `cardB`'s data was already staged by `cardA`'s call) — this is the
test that would have caught option (a)'s data-loss bug; **concurrent
syncs of the same connection:** two simultaneous `syncCard` calls for
sibling cards serialize on the `provider_connections` row lock rather than
both reading the same stale cursor; a `pendingTransactionId`-carrying
transaction whose old id is found as a `PENDING` row updates that row in
place (id, amount, `provider_pending: false`) rather than inserting a
duplicate; **the same but the found row is `PROMOTED`** updates only
`provider_transaction_id`/`provider_pending`, leaves `review_status`,
`promoted_expense_id` and amount untouched, and inserts nothing (step 7's
middle case — no duplicate resurfaces, no reviewed row is rewritten); the
same but the old id is *not* found falls back to a normal insert;
**a card linked into an already-existing connection** resets that
connection's `sync_cursor` to `null` (§3.5) so the next sync re-fetches
full history and the newly-tracked account's earlier transactions are not
stranded behind an advanced cursor;
`removedProviderTransactionIds` entries delete the matching `PENDING` staged
row and leave a `PROMOTED`/`DISMISSED` one untouched; a transaction whose
`providerAccountId` matches no tracked card is dropped without error and
without appearing in any card's counts.

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
   signature verification needs the exact bytes the webhook was signed
   over — for Plaid specifically, the raw body's SHA-256 hash is what gets
   checked against the JWT's `request_body_sha256` claim (§4.3), so an
   already-parsed/re-serialized body would hash differently and always fail
   verification. This must not share Express's global `express.json()`
   middleware.
2. `:provider` path param → `getProvider(name)`; unknown name → `404`
   (never throws past the router).
3. `await provider.verifyWebhookSignature({ rawBody, headers })` → `false` →
   `401`, nothing processed, nothing logged at more than `warn` level (don't
   spam logs with what could be scanning traffic). Both provider methods
   used in this route are `async` now (§4.1) — for Plaid this is a real
   network call (fetching the verification key on a cache miss), unlike
   Teller's synchronous HMAC compare, so the route handler must `await`
   both this and step 4.
4. `await provider.parseWebhookPayload(...)` → `ProviderWebhookEvent`.
   - `TRANSACTIONS_UPDATED`: resolve **every** `Card` sharing
     `providerConnectionId` (scoped query, no `userId` available from the
     webhook itself — this app has exactly one user, so "the cards with
     this `providerConnectionId`" is unambiguous; still written as a normal
     scoped repository lookup so nothing bypasses layering) and call
     `TransactionSyncService.syncCard` for **one** of them — per §5.1, one
     `syncCard` call under a shared connection already syncs every sibling
     card in one pass, so the router does not need to (and must not) loop
     and call `syncCard` once per matched card, that would just be the
     redundant-call case §5.1 already covers. Zero matched cards (e.g. an
     Item whose card(s) were all unlinked) is logged at `warn` and skipped,
     not an error — the webhook still returns `200` so Plaid doesn't retry
     forever.
   - `CONNECTION_DISCONNECTED`: mark **every** card sharing
     `providerConnectionId` `providerStatus = 'DISCONNECTED'`. No sync
     attempted.
   - `UNKNOWN`: log at `info`, return `200` (ack and ignore — a forward-compatible
     event type from the provider shouldn't cause retries).
5. Respond `200` only after processing completes. A crash mid-processing
   means no ack, and Plaid's own retry policy re-delivers — safe because
   ingestion is idempotent (§3.2, §5.1).

**Behaviors / test cases:** valid signature + known connection → staged rows
created/updated for every card under that connection, `200`; invalid
signature → `401`, no DB writes; unknown `:provider` → `404`; valid
payload, `providerConnectionId` matching no card → `200`, warning logged, no
staged rows; a connection with two cards → exactly one `syncCard` call made,
not two (regression test for the redundant-call pitfall named in §5.1);
same payload delivered twice → second delivery does not create duplicate
rows (relies on the same upsert path as §5.1); a provider sync error inside
the handler → `500`, so Plaid retries (this is the one path where a `500`
is correct, unlike the "unmatched connection" case above); a webhook-key
cache miss triggers exactly one `getWebhookVerificationKey` call, not one
per verification attempt within the same process.

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

**Confirmed unaffected by the Teller→Plaid switch.** This service only ever
consumes `ProviderTransaction.description` (a plain string) and matches it
against historical `Expense.concept` values — nothing here depends on how a
transaction was fetched, what provider it came from, or any of the
Item/cursor mechanics in §5.1. No changes below.

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
map as a first pass — flagged as a gap-fill decision in §12, since the user
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
  PLAID
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

type ProviderLinkSession {
  linkToken: String!
}

input CreateProviderLinkTokenInput {
  provider: TransactionProviderName!
}

input LinkCardAccountInput {
  cardId: ID!
  providerAccountId: String!
}

input LinkCardToProviderInput {
  provider: TransactionProviderName!
  publicToken: String!
  cards: [LinkCardAccountInput!]!
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
  createProviderLinkToken(input: CreateProviderLinkTokenInput!): ProviderLinkSession!
  linkCardToProvider(input: LinkCardToProviderInput!): [Card!]!
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
- `createProviderLinkToken` is new, and nothing in the Teller-era draft
  corresponded to it. It exists because Plaid Link cannot be opened at all
  without a server-minted `link_token` (§4.1's `createLinkSession`, §4.3's
  `/link/token/create`), and because that same call is the only place
  Plaid learns the webhook URL for the resulting Item. Flow: frontend calls
  this mutation, receives `linkToken`, passes it to the Plaid Link widget,
  and the widget's `onSuccess` then yields the `publicToken` fed into
  `linkCardToProvider` below. It persists nothing.
- `LinkCardToProviderInput` changed shape twice — once from the Teller-era
  draft, and again to fix a defect in the first Plaid draft. Teller Connect
  handed the frontend a directly-usable access token, so the original input
  carried `accessToken`/`providerConnectionId` straight from the client.
  Plaid Link's `onSuccess` callback instead hands the frontend a
  short-lived, **single-use** `public_token` plus metadata listing **every**
  account the user selected (each with its Plaid `account_id`) — it does
  **not** hand back a usable access token or an authoritative item id. So
  `accessToken` became `publicToken`, and `providerConnectionId` is dropped
  from client input entirely: the resolver derives it from
  `TransactionProvider.exchangeToken`'s response (§4.1), which is both
  correct (a client-reported item id can't be trusted) and simpler for the
  frontend.

  The defect in the first Plaid draft: it kept a single
  `cardId`/`providerAccountId` pair per call, which makes the multi-card
  case this design is otherwise built around (§3.1, §3.5, §5.1 — a checking
  account and a credit card under one bank login, called "the normal case
  for Plaid") **impossible to actually reach**. The `public_token` is
  single-use, so linking card A consumes it and card B's call fails at
  exchange; re-running Plaid Link to get a second token creates a *second
  Item* for the same institution, which burns one of the Trial plan's 10
  Items and splits the two cards across two Items with two independent
  cursors — precisely the situation §3.5 exists to avoid. Hence the input
  now carries `cards: [LinkCardAccountInput!]!`, one entry per account the
  user selected in Link, and the mutation returns `[Card!]!`.

  Resolver flow: exchange the `publicToken` **once** via
  `provider.exchangeToken` (the `provider.exchangeToken ? ... : treat input
  as an already-usable access token` fallback exists only for interface
  completeness per §4.1; Plaid always takes the exchange branch), encrypt
  the resulting `accessToken` once, then for **each** entry in `cards`
  store that same ciphertext plus the derived `providerConnectionId` and
  that entry's `providerAccountId` on the corresponding `Card` row — the
  per-card token duplication §3.1 already accepts. Then
  `ProviderConnectionRepository.findOrCreate` the `provider_connections`
  row (§3.5) so a cursor location exists before any sync, and if that row
  **already existed**, reset its `sync_cursor` to `null` per §3.5 so the
  newly-linked accounts' history isn't stranded behind an advanced cursor.
  All of it in one transaction: a partial link (some cards updated, others
  not) would leave the connection in a state no sync can reason about.
  The raw `publicToken`/`accessToken` travels over GraphQL and into the
  provider client exactly once each, is encrypted immediately in the
  resolver→service path, and is never echoed back — `Card` never exposes
  token fields, ciphertext included.
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

**Confirmed unaffected by the Teller→Plaid switch.** Everything here
operates purely on `staged_transactions`/`Period`/`Expense` rows that
already exist by the time promotion runs — it has no dependency on which
provider produced them, the cursor/connection mechanics, or anything else
in §3.5/§4/§5.1. No changes below.

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
lowercase `'plaid'` to the GraphQL enum's `PLAID` is done via an explicit
small lookup map in the adapter, not `.toUpperCase()`, so it doesn't silently
"work by accident" for a future multi-word provider id.

## 9. New files / modules summary

| Path | Responsibility |
|---|---|
| `migrations/20260829000000-cards-provider-link.cjs` | Additive columns + unique index on `"Cards"` (Phase 1, already merged) |
| `migrations/20260829010000-staged-transactions.cjs` | New `staged_transactions` table (Phase 1, already merged) |
| `migrations/20260829020000-provider-connections.cjs` | New `provider_connections` table — shared per-Item sync cursor (§3.5, new in this course correction) |
| `src/models/staged-transaction.ts` | Sequelize model + associations |
| `src/models/provider-connection.ts` | Sequelize model for `provider_connections` (§3.5) |
| `src/dto/staged-transaction-dto.ts` | `StagedTransactionDTO` |
| `src/security/token-cipher.ts` | AES-256-GCM encrypt/decrypt of provider tokens |
| `src/providers/provider.types.ts` | `TransactionProvider` interface + generic types — **revised** by this course correction, see §4.1 |
| `src/providers/provider-registry.ts` | `getProvider(name)` |
| `src/providers/plaid/plaid-client.ts` | Thin wrapper over the official `plaid` SDK; SDK types confined to this file |
| `src/providers/plaid/plaid-mapper.ts` | Plaid JSON → generic types |
| `src/providers/plaid/plaid-provider.ts` | `TransactionProvider` impl for Plaid, incl. JWT webhook verification |
| `src/repository/staged-transaction-repository.ts` | CRUD + idempotent upsert for staged rows |
| `src/repository/provider-connection-repository.ts` | `findOrCreate`/`updateCursor` (with row lock) for `provider_connections` (§3.5) |
| `src/service/transaction-sync-service.ts` | Orchestrates provider pull → staging, shared by all 3 triggers; connection-level internally, per-card contract externally (§5.1) |
| `src/service/transaction-staging-service.ts` | List/promote/dismiss staged rows |
| `src/service/category-suggestion-service.ts` | History-based subcategory suggestion |
| `src/adapters/staged-transaction-adapter.ts` | `StagedTransactionDTO` → GraphQL `StagedTransaction` |
| `src/http/app.ts` | Express app: mounts Apollo + webhook router (replaces `startStandaloneServer`) |
| `src/http/webhook-router.ts` | `POST /webhooks/:provider` |
| `src/jobs/run-transaction-sync-job.ts` | One-shot entrypoint for the scheduled Fly Machine |
| `src/resolvers/mutation/card/create-provider-link-token.ts` | Mints the Plaid Link `link_token` (§7) |
| `src/resolvers/mutation/card/link-card-to-provider.ts` | Exchanges the public token once, links every selected account's card |
| `src/resolvers/mutation/card/unlink-card-from-provider.ts` | |
| `src/resolvers/mutation/transaction/sync-transactions.ts` | |
| `src/resolvers/mutation/transaction/promote-staged-transaction.ts` | |
| `src/resolvers/mutation/transaction/dismiss-staged-transaction.ts` | |
| `src/resolvers/query/transaction/staged-transactions.ts` | |
| `src/resolvers/query/transaction/staged-transaction-by-id.ts` | |

Files named in the pre-Plaid draft that no longer apply, kept here only so
the omission is visible rather than silent: `src/providers/teller/*`
(`teller-client.ts`/`teller-mapper.ts`/`teller-provider.ts`) — exist in git
history from Phase 2, not part of this design (§0).

Modified files: `src/models/card.ts`, `src/dto/card-dto.ts`,
`src/models/init-models.ts`, `src/models/associations.ts`,
`src/adapters/income-adapter.ts` / `src/adapters/card-adapter.ts`,
`src/repository/card-repository.ts` (add
`findLinkedCards(userId)`/`linkProvider(...)`/`unlinkProvider(...)`/
`updateProviderSyncMetadata(...)`), `src/repository/expense-repository.ts`
(add the history-lookup method `CategorySuggestionService` needs, e.g.
`getRecentExpensesForSuggestion(userId, limit)`), `src/index.ts` (Express
migration), `schema.graphql`, `package.json` (new deps: `plaid`, `express`, `cors`,
`@types/express`, `@types/cors`, `jose`), `fly.toml` (document the second
scheduled machine), `.env`/Fly secrets (new vars listed in §4.3 and §3.3).

Possible future extension, not part of this design: MCP tools for staging
(`src/mcp/tools/staged-transaction-tools.ts`) so an AI agent could list/
promote staged transactions the same way it already manages expenses —
natural fit given `src/mcp/` mirrors the domain, but left out of this PR
sequence since the user only asked it be noted.

## 10. PR sequence

1. **PR1 — Data foundations. MERGED, do not re-plan.** Shipped the `Cards`
   migration, `staged_transactions` migration, `StagedTransaction` model,
   `Card` model/DTO updates, `token-cipher.ts`, and the original
   Teller-shaped `provider.types.ts`. Listed here only so the sequence reads
   correctly; its contents are already on
   `feature/auto-detect-transactions`.
1b. **PR1b — Plaid course-correction foundations.** *(New. An earlier draft
   of this section folded this work back into "PR1", which cannot happen —
   PR1 is merged.)* `provider_connections` migration (§3.5),
   `ProviderConnection` model, and the **in-place edit of the already-merged
   `src/providers/provider.types.ts`** to the Plaid-shaped interface from
   §4.1 (a breaking change to shipped code — currently zero blast radius,
   since the only consumer was the unmerged Teller branch). *Rationale:
   same character as PR1 — schema and shared type contract only, no external
   HTTP calls, fully unit-testable, and everything downstream depends on
   it. Kept as its own PR rather than bundled into PR2 so the breaking
   interface change is reviewable on its own.*
2. **PR2 — Plaid provider + link/unlink.** `plaid-client.ts`,
   `plaid-mapper.ts`, `plaid-provider.ts`, `provider-registry.ts`,
   `provider-connection-repository.ts`, `createProviderLinkToken` /
   `linkCardToProvider` / `unlinkCardFromProvider` mutations + schema (§7).
   *No syncing happens yet — this PR proves the whole link handshake works
   end to end: link token minted with the webhook URL registered, Plaid Link
   opened, public token exchanged once, access token stored encrypted
   against every selected account's card, `provider_connections` row
   find-or-created (and its cursor reset if it already existed). Depends on
   PR1b's columns/types; isolated behind mocked HTTP in tests.*
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
  constraint rejects a duplicate `(card_id, provider_transaction_id)`
  insert; `provider_connections`' unique constraint rejects a duplicate
  `(provider, provider_connection_id)` insert, and does **not** reject two
  different `Cards` rows independently referencing the same
  `providerConnectionId` (that duplication is expected and fine, per §3.1).
- **`plaid-mapper`**: see §4.4.
- **`plaid-provider.exchangeToken`**: see §4.4.
- **`plaid-provider.listTransactions`**: see §4.4.
- **`plaid-provider.verifyWebhookSignature`**: see §4.4.
- **`provider-registry`**: see §4.4.
- **`ProviderConnectionRepository`**: `findOrCreate` returns the existing row
  on a second call for the same `(provider, providerConnectionId)` rather
  than erroring or duplicating; `updateCursor` under a held row lock blocks
  a concurrent `updateCursor` call for the same row until the first
  transaction commits (see §3.5, §5.1's concurrent-sync test);
  `resetCursor` sets `sync_cursor` back to `null` and a subsequent sync
  therefore requests full history (§3.5).
- **`CardRepository` provider methods**: link sets all 8 columns correctly
  (all but `providerLastSyncedAt`, which stays null until the first sync)
  and encrypts the token (assert the stored value isn't the plaintext);
  **linking two cards from one `linkCardToProvider` call** gives both rows
  the same `providerConnectionId` and the same ciphertext, with different
  `providerAccountId`s, and creates exactly one `provider_connections` row
  (the multi-card regression test for §7's defect — without it, the
  "normal case for Plaid" of two accounts under one login is unreachable);
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

1. **Token fields live directly on `Cards`**, including duplicating the
   encrypted token if two cards ever shared one Plaid Item, rather than a
   separate reference table for the card↔provider link itself. Chosen for
   simplicity at personal-app scale and because you ruled out a join table
   for that link; a reference table isn't a join table so it was still an
   option, just not the one taken. (Unaffected by the Teller→Plaid switch —
   see the note appended to this rationale in §3.1. The *cursor* is a
   separate decision, #8 below.)
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
   revisiting if Plaid ever pushes large transaction batches per webhook.
   Slightly more relevant post-switch than it was for Teller, since one
   Plaid webhook can now fan out to a `syncCard` call covering multiple
   sibling cards' worth of transactions in one request (§5.1) — still judged
   acceptable at this app's actual scale (a handful of cards, one user), but
   worth re-checking if that assumption ever changes.
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
8. **New: the Plaid sync cursor lives in a new `provider_connections` table
   (§3.5), not as a column on `Cards`.** The task explicitly asked this be
   decided and specified precisely if it meant a new table, so flagging it
   here too even though it's already justified in full in §3.5 and §5.1 —
   the short version: the cursor is mutated on every sync (unlike the
   write-once token), so duplicating it across sibling `Cards` rows would
   create a real read-modify-write race between cards sharing an Item;
   giving it one row per connection, with an explicit lock on that row
   during sync, removes the race instead of just hoping it doesn't happen
   at this app's small scale.
9. **New: `provider.types.ts` (Phase 1, already merged) is being edited in
   place, not extended.** `listTransactions` changes from
   account-scoped/date-based to connection-scoped/cursor-based, the
   `TRANSACTIONS_UPDATED` webhook event changes from
   `providerAccountIds: string[]` to a single `providerConnectionId`, both
   webhook methods become `async`, and an optional `exchangeToken` method
   and an optional `ProviderTransaction.pendingTransactionId` field are
   added. Full rationale in §4.1. Flagged here as the single highest-impact
   decision in this course correction, since it's the one place this
   document reaches back into code that already shipped and merged, rather
   than only describing code that hasn't been written yet. (Also gains an
   optional `createLinkSession` method — see #10.)

### 12b. Defects found in the first Plaid draft, and how they were fixed

The Plaid rewrite above was reviewed against the actual repo and against
Plaid's real API model before implementation started. The following were
found wrong or missing in that first draft and have been corrected in place;
they are listed separately from the gap-fills above because these were
errors, not judgement calls.

10. **The `/link/token/create` step was missing entirely, which would have
    blocked the feature from ever working.** The draft's flow began at
    "Plaid Link hands back a public_token", but Plaid Link cannot be opened
    without a server-minted `link_token`, and that call is also the only
    place Plaid is told the webhook URL for the Item. As written, there
    would have been no way to open Link and no webhooks would ever have been
    delivered to §5.2's receiver. Fixed by adding the optional
    `createLinkSession` interface method (§4.1), `createLinkToken` in
    `plaid-client.ts` (§4.3), the `createProviderLinkToken` mutation (§7),
    and the `PLAID_WEBHOOK_URL` env var.
11. **Linking a second card under the same Item was impossible, contradicting
    the design's own "normal case".** `LinkCardToProviderInput` took one
    `cardId`/`providerAccountId` and a single-use `publicToken`, so the
    checking-plus-credit-card-under-one-login scenario that §3.5 and §5.1
    are built around could never actually be set up. Fixed by making the
    input carry `cards: [LinkCardAccountInput!]!` and return `[Card!]!`
    (§7), linking every selected account from one token exchange.
12. **The `pendingTransactionId` reconciliation contradicted itself.** §5.1
    step 7 said to update the matched pending row in place, and listed
    "already promoted/dismissed" as a *not-found* case — but promotion
    doesn't delete rows, so such a row **is** found, and updating it in
    place would violate the never-overwrite-reviewed rule stated in the same
    step. Fixed by splitting the case three ways, with a narrow
    identity-only update (`provider_transaction_id`, `provider_pending`) for
    reviewed rows so re-deliveries match instead of duplicating.
13. **The `providerStatus = 'ERROR'` write was specified inside the
    transaction that gets rolled back on failure**, so the error marker
    would have been discarded by its own rollback and the card would look
    untouched after a failed sync. Fixed in §5.1 step 9: roll back first,
    then write ERROR in a separate committed transaction, then rethrow.
14. **The row lock is held across external HTTP calls, and no request
    timeout was specified anywhere.** The lock-across-I/O is accepted (the
    alternative reintroduces the race), but it is now stated explicitly as a
    tradeoff rather than left implicit, and a mandatory axios `timeout` on
    every Plaid call (§4.3) bounds the worst-case lock hold time.
15. **A card added to an already-linked connection would have permanently
    missed its history.** §5.1 step 6 drops untracked accounts' transactions
    while the cursor advances past them, so a later-added card for one of
    those accounts could never retrieve them. Fixed in §3.5/§7: linking into
    an existing `provider_connections` row resets its `sync_cursor` to
    `null`, forcing a safe full re-sync (safe because ingestion is
    idempotent and reviewed rows are never overwritten).
16. **Two Plaid facts the draft left flagged as unverified are now
    resolved**, and the doc no longer asks the implementor to check them:
    `PLAID_ENV` is `sandbox`/`production` only (the standalone `development`
    environment was retired), and webhook verification keys need no cache
    TTL (rotation issues a new `kid`, so a `kid`-keyed cache cannot go
    stale).
17. **Housekeeping.** PR1 is merged, so the sequence in §10 no longer folds
    new work into it — the `provider_connections` migration and the
    `provider.types.ts` edit now live in a new PR1b. Stale cross-references
    in §3.2 (to a nonexistent "§5.4" and "§7.2") were repointed to §5.1 and
    §6. §0 now records that the Teller branch stays unmerged and that Plaid
    work branches from `feature/auto-detect-transactions`, which contains no
    Teller code.

18. **Decision reversed: use the official `plaid` SDK instead of a
    hand-rolled REST client.** The first draft hand-rolled one for
    consistency with `udi-client.ts` and flagged the SDK as worth
    reconsidering; on reconsideration the SDK wins, because the hand-rolled
    client is precisely where this design's unverified-shape risk
    concentrated, and the SDK's OpenAPI-generated types turn those guesses
    into compile errors. Full rationale in §4.3's dependency note. The SDK
    is confined to `plaid-client.ts`; no design mechanics change.

Still genuinely unverified, and to be confirmed during implementation —
though the surface has shrunk substantially now that the official `plaid`
SDK's generated types cover the request/response shapes (#18). What the
SDK's type checker cannot settle, and still needs a judgement call:
the precise set of `webhook_code` values that should map to
`CONNECTION_DISCONNECTED` (the SDK will enumerate the possible codes, but
not which of them this app should treat as "stop syncing, tell the user to
re-link"); and whether `removed` entries carry an `account_id` (§5.1 step 8
is deliberately written not to depend on it either way, so this one is
informational rather than blocking). The exact SDK method spellings used
throughout §4.3 (`linkTokenCreate`, `itemPublicTokenExchange`,
`transactionsSync`, `accountsGet`, `webhookVerificationKeyGet`) were
likewise written from memory — `tsc` will confirm or correct each of them
on first compile.
