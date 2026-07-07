# ADR-016: Registration Store Postgres Backend

## Status

Proposed

## Context

Registration configuration and invite codes currently live in the Account process through a memory or file-backed store. The file backend is acceptable for a single-instance MVP, but it is not safe for horizontal production use:

- invite code reservation increments are read-modify-write operations;
- concurrent Account replicas can oversell a code when `maxUseCount` is small;
- file locks and atomic renames do not provide cross-host transaction semantics;
- production rollout needs a clear migration path from `MOAUTH_REGISTRATION_CONFIG_STORE_PATH`.

The highest-risk path is invite mode: `reserveInviteCode` must atomically check validity and consume one available use before Zitadel user creation continues.

## Decision

Add a Postgres backend for the registration store, implemented as an independent workspace package:

```text
packages/registration-store-pg
```

Use Postgres plus Drizzle schema definitions for the PoC.

Tables:

- `registration_config`
- `invite_codes`
- `invite_reservations`

The Account app selects the backend with:

```text
MOAUTH_REGISTRATION_STORE_BACKEND=memory|file|pg
MOAUTH_REGISTRATION_STORE_DATABASE_URL=postgres://...
MOAUTH_REGISTRATION_STORE_SCHEMA=public
```

Default behavior remains unchanged:

- `NODE_ENV=test` defaults to `memory`.
- non-test runtime defaults to `file`.

The Postgres backend is explicit opt-in for this PoC.

## Transaction Contract

`reserveInviteCode(code)` must run in a database transaction:

1. `SELECT ... FOR UPDATE` the invite code row.
2. Reject missing, revoked, expired, or exhausted codes.
3. Insert an `active` reservation row.
4. Increment `used_count`.
5. Commit.

`releaseInviteCode(reservationId)` must lock the reservation row, transition only `active -> released`, and decrement the parent invite code count once.

`consumeInviteCode(reservationId, user)` must lock the reservation row and transition only `active -> consumed`. It does not decrement usage.

The reservation id is the only release/consume handle. Releasing by code is forbidden because it can undo another concurrent reservation.

## Alternatives Considered

### Postgres + Drizzle

Accepted for the PoC.

Postgres is already part of the MoAuth/Zitadel deployment shape, provides row-level locks and transactions, and supports later production migration for other stores.

Drizzle keeps schema definitions close to code without introducing a heavyweight ORM model. The PoC may use raw SQL inside transactions when explicit row locks are clearer than ORM builders.

### SQLite + better-sqlite3

Rejected for this production path.

SQLite can provide local transactional behavior, but it does not solve multi-replica, multi-host production semantics without shared storage constraints. It remains useful for local-only tooling, not the target production store.

### Keep File Store With Locks

Rejected for production multi-replica use.

File locks are platform and filesystem dependent, and they do not provide clean cross-container or cross-host semantics. Keeping the file backend is fine for single-instance local/staging deployments with explicit sign-off.

## Test Backend Strategy

Memory remains the default test backend because most Account tests do not need database coverage.

The Postgres package owns database-specific tests. These tests require:

```text
MOAUTH_REGISTRATION_STORE_TEST_DATABASE_URL
```

If the variable is unset, the Postgres package tests skip with a clear message. CI can enable them by providing a disposable Postgres database.

The Account integration test suite will include pg-backend smoke tests only when the database URL is present.

## Migration Path

Existing file deployments keep:

```text
MOAUTH_REGISTRATION_CONFIG_STORE_PATH=/data/registration-config.json
```

To migrate:

1. Deploy code with `MOAUTH_REGISTRATION_STORE_BACKEND=file`.
2. Export the JSON file with current `registration_config`, `invite_codes`, and `invite_reservations`.
3. Import into Postgres using an administrative migration command.
4. Switch one Account instance to:

   ```text
   MOAUTH_REGISTRATION_STORE_BACKEND=pg
   MOAUTH_REGISTRATION_STORE_DATABASE_URL=...
   ```

5. Verify admin registration settings and invite registration.
6. Roll out the same pg backend to all Account replicas.

This ADR does not implement the import command; the PoC only proves the runtime store contract and concurrent reservation behavior.

## Connection Pooling

Each Account process creates one pg pool for the registration store.

Initial PoC defaults:

```text
MOAUTH_REGISTRATION_STORE_POOL_MAX=5
```

Production sizing must account for:

- Account replica count;
- Postgres max connections;
- other MoAuth stores that later move to Postgres;
- Zitadel database isolation if sharing infrastructure.

Use PgBouncer or a platform connection pool before scaling replicas broadly.

## Guardrails

- Do not make pg the default until migration tooling and staging evidence exist.
- Do not silently fall back from pg to file if the database is unavailable.
- Do not allow invite code reservation outside a transaction.
- Do not release or consume invite reservations by code.
- Keep memory and file backends available for tests and single-instance development.
