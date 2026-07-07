import pg from "pg";
import { randomUUID } from "node:crypto";
import { drizzle } from "drizzle-orm/node-postgres";

import { schema } from "./schema.js";

const { Pool } = pg;

const VALID_MODES = new Set(["open", "closed", "review", "invite"]);
const INVITE_CODE_PREFIX = "MOAUTH-";

function generateInviteCode() {
  const hex = randomUUID().replace(/-/g, "").slice(0, 8).toUpperCase();
  return `${INVITE_CODE_PREFIX}${hex}`;
}

function assertIdentifier(value, label) {
  if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(value)) {
    throw new Error(`${label} must be a valid PostgreSQL identifier.`);
  }
}

function quoteIdent(value) {
  assertIdentifier(value, "identifier");
  return `"${value}"`;
}

function qualified(schemaName, tableName) {
  return `${quoteIdent(schemaName)}.${quoteIdent(tableName)}`;
}

function toIso(value) {
  if (!value) return null;
  return value instanceof Date ? value.toISOString() : new Date(value).toISOString();
}

function serializeConfig(row) {
  return {
    mode: row?.mode || "open",
    updatedAt: toIso(row?.updated_at),
    updatedBy: row?.updated_by || null,
  };
}

function serializeInviteCode(row) {
  return {
    code: row.code,
    maxUseCount: Number(row.max_use_count),
    usedCount: Number(row.used_count),
    isRevoked: Boolean(row.is_revoked),
    createdBy: row.created_by || null,
    createdAt: toIso(row.created_at),
    expiresAt: toIso(row.expires_at),
  };
}

function normalizeMaxUseCount(maxUseCount) {
  return Number.isInteger(maxUseCount) && maxUseCount > 0 ? maxUseCount : 1;
}

async function withTransaction(pool, fn) {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const result = await fn(client);
    await client.query("COMMIT");
    return result;
  } catch (error) {
    try {
      await client.query("ROLLBACK");
    } catch {
      // Keep the original transaction error.
    }
    throw error;
  } finally {
    client.release();
  }
}

export function createPostgresRegistrationStore(options = {}) {
  const connectionString = options.connectionString;
  const schemaName = options.schemaName || "public";
  const nowFn = options.now || (() => new Date());
  const randomId = options.randomId || randomUUID;
  const autoMigrate = options.autoMigrate !== false;
  const pool =
    options.pool ||
    new Pool({
      connectionString,
      max: Number.parseInt(String(options.poolMax || 5), 10),
    });

  if (!options.pool && !connectionString) {
    throw new Error("createPostgresRegistrationStore requires connectionString or pool.");
  }
  assertIdentifier(schemaName, "schemaName");

  // Keep Drizzle schema wired for typed schema ownership. Explicit row-locking
  // transactions below use SQL because the lock semantics are the store contract.
  const db = drizzle(pool, { schema });
  let readyPromise = null;

  async function ensureReady() {
    if (!readyPromise) {
      readyPromise = autoMigrate ? migrate() : Promise.resolve();
    }
    return readyPromise;
  }

  async function migrate() {
    const configTable = qualified(schemaName, "registration_config");
    const codesTable = qualified(schemaName, "invite_codes");
    const reservationsTable = qualified(schemaName, "invite_reservations");
    await pool.query(`CREATE SCHEMA IF NOT EXISTS ${quoteIdent(schemaName)}`);
    await pool.query(`
      CREATE TABLE IF NOT EXISTS ${configTable} (
        key text PRIMARY KEY,
        mode text NOT NULL CHECK (mode IN ('open', 'closed', 'review', 'invite')),
        updated_at timestamptz,
        updated_by text
      )
    `);
    await pool.query(`
      CREATE TABLE IF NOT EXISTS ${codesTable} (
        code text PRIMARY KEY,
        max_use_count integer NOT NULL CHECK (max_use_count > 0),
        used_count integer NOT NULL DEFAULT 0 CHECK (used_count >= 0),
        is_revoked boolean NOT NULL DEFAULT false,
        created_by text,
        created_at timestamptz NOT NULL,
        expires_at timestamptz,
        CHECK (used_count <= max_use_count)
      )
    `);
    await pool.query(`
      CREATE TABLE IF NOT EXISTS ${reservationsTable} (
        reservation_id text PRIMARY KEY,
        code text NOT NULL REFERENCES ${codesTable}(code) ON DELETE CASCADE,
        status text NOT NULL CHECK (status IN ('active', 'released', 'consumed')),
        created_at timestamptz NOT NULL,
        consumed_at timestamptz,
        consumed_by_user_id text,
        consumed_by_email text
      )
    `);
    await pool.query(
      `INSERT INTO ${configTable} (key, mode, updated_at, updated_by)
       VALUES ('default', 'open', NULL, NULL)
       ON CONFLICT (key) DO NOTHING`
    );
  }

  async function getConfig() {
    await ensureReady();
    const result = await pool.query(
      `SELECT mode, updated_at, updated_by FROM ${qualified(schemaName, "registration_config")} WHERE key = 'default'`
    );
    return serializeConfig(result.rows[0]);
  }

  async function setConfig({ mode, updatedBy }) {
    await ensureReady();
    if (!VALID_MODES.has(mode)) throw new Error(`Invalid registration mode: ${mode}`);
    const now = nowFn();
    const result = await pool.query(
      `INSERT INTO ${qualified(schemaName, "registration_config")} (key, mode, updated_at, updated_by)
       VALUES ('default', $1, $2, $3)
       ON CONFLICT (key) DO UPDATE SET mode = EXCLUDED.mode, updated_at = EXCLUDED.updated_at, updated_by = EXCLUDED.updated_by
       RETURNING mode, updated_at, updated_by`,
      [mode, now, updatedBy || null]
    );
    return serializeConfig(result.rows[0]);
  }

  async function listInviteCodes() {
    await ensureReady();
    const result = await pool.query(
      `SELECT code, max_use_count, used_count, is_revoked, created_by, created_at, expires_at
       FROM ${qualified(schemaName, "invite_codes")}
       ORDER BY created_at DESC`
    );
    return result.rows.map(serializeInviteCode);
  }

  async function createInviteCode({ maxUseCount, expiresAt, code, createdBy } = {}) {
    await ensureReady();
    const inviteCode = code || generateInviteCode();
    const now = nowFn();
    const result = await pool.query(
      `INSERT INTO ${qualified(schemaName, "invite_codes")}
         (code, max_use_count, used_count, is_revoked, created_by, created_at, expires_at)
       VALUES ($1, $2, 0, false, $3, $4, $5)
       RETURNING code, max_use_count, used_count, is_revoked, created_by, created_at, expires_at`,
      [
        inviteCode,
        normalizeMaxUseCount(maxUseCount),
        createdBy || null,
        now,
        expiresAt ? new Date(expiresAt) : null,
      ]
    );
    return serializeInviteCode(result.rows[0]);
  }

  async function revokeInviteCode(code) {
    await ensureReady();
    const result = await pool.query(
      `UPDATE ${qualified(schemaName, "invite_codes")}
       SET is_revoked = true
       WHERE code = $1
       RETURNING code, max_use_count, used_count, is_revoked, created_by, created_at, expires_at`,
      [code]
    );
    if (!result.rows[0]) throw new Error(`Invite code not found: ${code}`);
    return serializeInviteCode(result.rows[0]);
  }

  async function getInviteCode(code) {
    await ensureReady();
    const result = await pool.query(
      `SELECT code, max_use_count, used_count, is_revoked, created_by, created_at, expires_at
       FROM ${qualified(schemaName, "invite_codes")}
       WHERE code = $1`,
      [code]
    );
    return result.rows[0] ? serializeInviteCode(result.rows[0]) : null;
  }

  async function reserveInviteCode(code) {
    await ensureReady();
    return await withTransaction(pool, async (client) => {
      const result = await client.query(
        `SELECT code, max_use_count, used_count, is_revoked, expires_at
         FROM ${qualified(schemaName, "invite_codes")}
         WHERE code = $1
         FOR UPDATE`,
        [code]
      );
      const record = result.rows[0];
      if (!record) throw new Error("邀请码不存在");
      if (record.is_revoked) throw new Error("邀请码已作废");
      if (record.expires_at && new Date(record.expires_at) < nowFn()) throw new Error("邀请码已过期");
      if (Number(record.used_count) >= Number(record.max_use_count)) throw new Error("邀请码已用完");

      const reservationId = randomId();
      const now = nowFn();
      await client.query(
        `INSERT INTO ${qualified(schemaName, "invite_reservations")}
           (reservation_id, code, status, created_at, consumed_at, consumed_by_user_id, consumed_by_email)
         VALUES ($1, $2, 'active', $3, NULL, NULL, NULL)`,
        [reservationId, code, now]
      );
      await client.query(
        `UPDATE ${qualified(schemaName, "invite_codes")}
         SET used_count = used_count + 1
         WHERE code = $1`,
        [code]
      );
      return { reservationId, code };
    });
  }

  async function releaseInviteCode(reservationId) {
    await ensureReady();
    return await withTransaction(pool, async (client) => {
      const result = await client.query(
        `SELECT reservation_id, code, status
         FROM ${qualified(schemaName, "invite_reservations")}
         WHERE reservation_id = $1
         FOR UPDATE`,
        [reservationId]
      );
      const reservation = result.rows[0];
      if (!reservation || reservation.status !== "active") return false;

      await client.query(
        `UPDATE ${qualified(schemaName, "invite_reservations")}
         SET status = 'released'
         WHERE reservation_id = $1`,
        [reservationId]
      );
      await client.query(
        `UPDATE ${qualified(schemaName, "invite_codes")}
         SET used_count = GREATEST(used_count - 1, 0)
         WHERE code = $1`,
        [reservation.code]
      );
      return true;
    });
  }

  async function consumeInviteCode(reservationId, { userId, email } = {}) {
    await ensureReady();
    return await withTransaction(pool, async (client) => {
      const result = await client.query(
        `SELECT reservation_id, status
         FROM ${qualified(schemaName, "invite_reservations")}
         WHERE reservation_id = $1
         FOR UPDATE`,
        [reservationId]
      );
      const reservation = result.rows[0];
      if (!reservation || reservation.status !== "active") return false;

      await client.query(
        `UPDATE ${qualified(schemaName, "invite_reservations")}
         SET status = 'consumed', consumed_at = $2, consumed_by_user_id = $3, consumed_by_email = $4
         WHERE reservation_id = $1`,
        [reservationId, nowFn(), userId || null, email || null]
      );
      return true;
    });
  }

  async function resetForTests() {
    await ensureReady();
    await pool.query(`DELETE FROM ${qualified(schemaName, "invite_reservations")}`);
    await pool.query(`DELETE FROM ${qualified(schemaName, "invite_codes")}`);
    await pool.query(`DELETE FROM ${qualified(schemaName, "registration_config")}`);
    await pool.query(
      `INSERT INTO ${qualified(schemaName, "registration_config")} (key, mode, updated_at, updated_by)
       VALUES ('default', 'open', NULL, NULL)`
    );
  }

  async function close() {
    if (!options.pool) {
      await pool.end();
    }
  }

  return {
    db,
    pool,
    schemaName,
    getConfig,
    setConfig,
    listInviteCodes,
    createInviteCode,
    revokeInviteCode,
    getInviteCode,
    reserveInviteCode,
    releaseInviteCode,
    consumeInviteCode,
    _resetForTests: resetForTests,
    close,
  };
}

export { schema } from "./schema.js";
