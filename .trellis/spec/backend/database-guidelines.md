# Database Guidelines

> Database patterns and conventions for this project.

---

## Registration Store Postgres Backend

### 1. Scope / Trigger

Use this contract when changing Account registration configuration, invite-code storage, or the Postgres-backed registration store.

Relevant files:

- `apps/account/src/registration/config-store.js`
- `packages/registration-store-pg/src/index.js`
- `packages/registration-store-pg/src/schema.js`
- `packages/registration-store-pg/test/registration-store-pg.test.js`
- `apps/account/test/registration-config-pg.test.js`

### 2. Signatures

Account-facing registration store functions may return either a plain value for memory/file backends or a Promise for pg. Runtime callers must always `await` these functions:

```js
await getRegistrationConfig();
await setRegistrationConfig({ mode }, actor);
await listInviteCodes();
await createInviteCode({ maxUseCount, expiresAt });
await revokeInviteCode(code);
await getInviteCode(code);
await reserveInviteCode(code);
await releaseInviteCode(reservationId);
await consumeInviteCode(reservationId, { userId, email });
await resetRegistrationConfigForTests();
```

The pg package factory is:

```js
createPostgresRegistrationStore({
  connectionString,
  schemaName = "public",
  poolMax = 5,
  autoMigrate = true,
  pool,
  now,
  randomId,
});
```

### 3. Contracts

Backend selection is controlled by environment:

| Env key | Values | Required | Contract |
|---|---|---:|---|
| `MOAUTH_REGISTRATION_STORE_BACKEND` | `memory`, `file`, `pg` | No | Defaults to `memory` in `NODE_ENV=test`, otherwise `file`. Invalid values fail fast. |
| `MOAUTH_REGISTRATION_CONFIG_STORE_PATH` | file path | Only file override | Existing file backend path; remains backward compatible. |
| `MOAUTH_REGISTRATION_STORE_DATABASE_URL` | Postgres URL | Yes when backend is `pg` | Missing value must fail closed. Do not fall back to file. |
| `MOAUTH_REGISTRATION_STORE_SCHEMA` | Postgres identifier | No | Defaults to `public`; must be identifier-safe. |
| `MOAUTH_REGISTRATION_STORE_POOL_MAX` | integer | No | Defaults to `5`; per Account process. |
| `MOAUTH_REGISTRATION_STORE_TEST_DATABASE_URL` | Postgres URL | Test only | Enables pg tests; tests skip clearly when unset. |

Postgres tables owned by `packages/registration-store-pg/src/schema.js`:

| Table | Required fields |
|---|---|
| `registration_config` | `key`, `mode`, `updated_at`, `updated_by` |
| `invite_codes` | `code`, `max_use_count`, `used_count`, `is_revoked`, `created_by`, `created_at`, `expires_at` |
| `invite_reservations` | `reservation_id`, `code`, `status`, `created_at`, `consumed_at`, `consumed_by_user_id`, `consumed_by_email` |

### 4. Validation & Error Matrix

| Operation | Validation | Error behavior |
|---|---|---|
| backend resolve | backend in `memory/file/pg` | throw `Invalid MOAUTH_REGISTRATION_STORE_BACKEND` |
| pg backend create | database URL present | throw `MOAUTH_REGISTRATION_STORE_DATABASE_URL is required...` |
| schema name | PostgreSQL identifier only | throw identifier validation error |
| `setConfig` | mode in `open/closed/review/invite` | throw `Invalid registration mode` |
| `reserveInviteCode` | code exists | throw `邀请码不存在` |
| `reserveInviteCode` | not revoked | throw `邀请码已作废` |
| `reserveInviteCode` | not expired | throw `邀请码已过期` |
| `reserveInviteCode` | `used_count < max_use_count` | throw `邀请码已用完` |
| `releaseInviteCode` | reservation exists and is `active` | return `false` when absent/non-active |
| `consumeInviteCode` | reservation exists and is `active` | return `false` when absent/non-active |

### 5. Good / Base / Bad Cases

Good:

```js
const reservation = await reserveInviteCode(code);
try {
  const user = await registerHumanUser(...);
  await consumeInviteCode(reservation.reservationId, { userId: user.userId, email: user.email });
} catch (error) {
  await releaseInviteCode(reservation.reservationId);
  throw error;
}
```

Base:

```js
const codes = await listInviteCodes();
const config = await getRegistrationConfig();
```

Bad:

```js
const reservation = reserveInviteCode(code); // wrong: breaks pg backend
releaseInviteCode(code); // wrong: release must use reservationId, never code
```

### 6. Tests Required

When changing this area, run:

```bash
npm --workspace @moauth/registration-store-pg run test
npm --workspace @moauth/account run test
npm run test:ci
```

With a disposable Postgres database, also run:

```bash
MOAUTH_REGISTRATION_STORE_TEST_DATABASE_URL='<postgres-url>' npm --workspace @moauth/registration-store-pg run test
MOAUTH_REGISTRATION_STORE_TEST_DATABASE_URL='<postgres-url>' npm --workspace @moauth/account run test
MOAUTH_REGISTRATION_STORE_BACKEND=pg \
MOAUTH_REGISTRATION_STORE_DATABASE_URL='<postgres-url>' \
MOAUTH_REGISTRATION_STORE_SCHEMA='<temporary-schema>' \
NODE_ENV=test node --test apps/account/test/lifecycle.test.js
```

Required assertion points:

- 10 concurrent `reserveInviteCode` calls against one `maxUseCount=1` code produce exactly 1 success and 9 failures.
- `releaseInviteCode(reservationId)` is idempotent and decrements usage at most once.
- `consumeInviteCode(reservationId, user)` is idempotent and does not decrement usage.
- Existing lifecycle invite-mode tests pass under pg backend.

### 7. Wrong vs Correct

#### Wrong

```js
// Read-modify-write without a database transaction can oversell invite codes.
const code = await getInviteCode(inviteCode);
if (code.usedCount < code.maxUseCount) {
  await updateInviteCode({ usedCount: code.usedCount + 1 });
}
```

#### Correct

```sql
SELECT code, max_use_count, used_count
FROM invite_codes
WHERE code = $1
FOR UPDATE;
```

Then insert the active reservation and increment `used_count` inside the same transaction.

---

## Common Mistakes

- Do not make `pg` the implicit default before migration tooling and staging evidence exist.
- Do not silently fall back from `pg` to `file` when the database is unavailable.
- Do not add Account runtime code that assumes registration store calls are synchronous.
- Do not put local database credentials or `.env` contents in docs, tests, or commits.
