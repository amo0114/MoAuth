import { mkdirSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import { randomUUID } from "node:crypto";
import path from "node:path";

const VALID_MODES = new Set(["open", "closed", "review", "invite"]);
const INVITE_CODE_PREFIX = "MOAUTH-";

function generateInviteCode() {
  const hex = randomUUID().replace(/-/g, "").slice(0, 8).toUpperCase();
  return `${INVITE_CODE_PREFIX}${hex}`;
}

function resolveStorePath() {
  const configured = String(process.env.MOAUTH_REGISTRATION_CONFIG_STORE_PATH || "").trim();
  if (configured) return configured;
  return path.join(process.cwd(), "../../data/registration-config.json");
}

function createMemoryStore() {
  let config = { mode: "open", updatedAt: null, updatedBy: null };
  const inviteCodes = new Map();      // code → record
  const reservations = new Map();     // reservationId → record

  // --- Config ---
  function getConfig() { return { ...config }; }

  function setConfig({ mode, updatedBy }) {
    if (!VALID_MODES.has(mode)) throw new Error(`Invalid registration mode: ${mode}`);
    config = { mode, updatedAt: new Date().toISOString(), updatedBy: updatedBy || null };
    return { ...config };
  }

  // --- Invite Codes CRUD ---
  function listInviteCodes() {
    return [...inviteCodes.values()]
      .map((r) => ({ ...r, createdAt: r.createdAt.toISOString(), expiresAt: r.expiresAt?.toISOString() || null }))
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }

  function createInviteCode({ maxUseCount, expiresAt }) {
    const code = generateInviteCode();
    const record = {
      code,
      maxUseCount: Number.isInteger(maxUseCount) && maxUseCount > 0 ? maxUseCount : 1,
      usedCount: 0,
      isRevoked: false,
      createdBy: null,
      createdAt: new Date(),
      expiresAt: expiresAt ? new Date(expiresAt) : null,
    };
    inviteCodes.set(code, record);
    return { ...record, createdAt: record.createdAt.toISOString(), expiresAt: record.expiresAt?.toISOString() || null };
  }

  function revokeInviteCode(code) {
    const record = inviteCodes.get(code);
    if (!record) throw new Error(`Invite code not found: ${code}`);
    record.isRevoked = true;
    return { ...record, createdAt: record.createdAt.toISOString(), expiresAt: record.expiresAt?.toISOString() || null };
  }

  function getInviteCode(code) {
    const record = inviteCodes.get(code);
    if (!record) return null;
    return { ...record, createdAt: record.createdAt.toISOString(), expiresAt: record.expiresAt?.toISOString() || null };
  }

  // --- Reservations ---
  function reserveInviteCode(code) {
    const record = inviteCodes.get(code);
    if (!record) throw new Error("邀请码不存在");
    if (record.isRevoked) throw new Error("邀请码已作废");
    if (record.expiresAt && record.expiresAt < new Date()) throw new Error("邀请码已过期");
    if (record.usedCount >= record.maxUseCount) throw new Error("邀请码已用完");

    const reservationId = randomUUID();
    const reservation = {
      reservationId,
      code,
      status: "active",
      createdAt: new Date(),
      consumedAt: null,
      consumedByUserId: null,
      consumedByEmail: null,
    };
    reservations.set(reservationId, reservation);
    record.usedCount += 1;

    return { reservationId, code };
  }

  function releaseInviteCode(reservationId) {
    const reservation = reservations.get(reservationId);
    if (!reservation) return false;
    if (reservation.status !== "active") return false;
    reservation.status = "released";
    const record = inviteCodes.get(reservation.code);
    if (record && record.usedCount > 0) {
      record.usedCount -= 1;
    }
    return true;
  }

  function consumeInviteCode(reservationId, { userId, email }) {
    const reservation = reservations.get(reservationId);
    if (!reservation) return false;
    if (reservation.status !== "active") return false;
    reservation.status = "consumed";
    reservation.consumedAt = new Date();
    reservation.consumedByUserId = userId || null;
    reservation.consumedByEmail = email || null;
    return true;
  }

  // --- Test/Serialization ---
  function _reset() {
    config = { mode: "open", updatedAt: null, updatedBy: null };
    inviteCodes.clear();
    reservations.clear();
  }

  function _export() {
    return {
      version: 1,
      ...config,
      inviteCodes: Object.fromEntries(inviteCodes.entries()),
      reservations: Object.fromEntries(
        [...reservations.entries()].map(([id, r]) => [
          id,
          { ...r, createdAt: r.createdAt.toISOString(), consumedAt: r.consumedAt?.toISOString() || null },
        ])
      ),
    };
  }

  function loadSerialized(data) {
    if (!data) return;
    const serializedConfig = data.config || data;
    if (serializedConfig) {
      const c = serializedConfig;
      config = {
        mode: VALID_MODES.has(c.mode) ? c.mode : "open",
        updatedAt: c.updatedAt || null,
        updatedBy: c.updatedBy || null,
      };
    }
    if (data.inviteCodes) {
      inviteCodes.clear();
      for (const [code, record] of Object.entries(data.inviteCodes)) {
        inviteCodes.set(code, {
          ...record,
          createdAt: new Date(record.createdAt),
          expiresAt: record.expiresAt ? new Date(record.expiresAt) : null,
        });
      }
    }
    if (data.reservations) {
      reservations.clear();
      for (const [id, record] of Object.entries(data.reservations)) {
        reservations.set(id, {
          ...record,
          createdAt: new Date(record.createdAt),
          consumedAt: record.consumedAt ? new Date(record.consumedAt) : null,
        });
      }
    }
  }

  return {
    getConfig, setConfig, listInviteCodes, createInviteCode, revokeInviteCode, getInviteCode,
    reserveInviteCode, releaseInviteCode, consumeInviteCode,
    _reset, _resetForTests: _reset, _export, loadSerialized,
  };
}

function createFileStore() {
  const filePath = resolveStorePath();
  const memory = createMemoryStore();
  let loaded = false;

  function ensureLoaded() {
    if (loaded) return;
    try {
      const raw = readFileSync(filePath, "utf8");
      const parsed = JSON.parse(raw);
      memory.loadSerialized(parsed || {});
    } catch (error) {
      if (error?.code !== "ENOENT") throw error;
    }
    loaded = true;
  }

  function persist() {
    mkdirSync(path.dirname(filePath), { recursive: true });
    const payload = memory._export();
    const tempPath = `${filePath}.${process.pid}.${randomUUID()}.tmp`;
    writeFileSync(tempPath, `${JSON.stringify(payload, null, 2)}\n`, "utf8");
    renameSync(tempPath, filePath);
  }

  function wrap(method) {
    return (...args) => { ensureLoaded(); const result = method(...args); persist(); return result; };
  }

  return {
    getConfig: (...args) => { ensureLoaded(); return memory.getConfig(...args); },
    setConfig: wrap(memory.setConfig.bind(memory)),
    listInviteCodes: (...args) => { ensureLoaded(); return memory.listInviteCodes(...args); },
    createInviteCode: wrap(memory.createInviteCode.bind(memory)),
    revokeInviteCode: wrap(memory.revokeInviteCode.bind(memory)),
    getInviteCode: (...args) => { ensureLoaded(); return memory.getInviteCode(...args); },
    reserveInviteCode: wrap(memory.reserveInviteCode.bind(memory)),
    releaseInviteCode: wrap(memory.releaseInviteCode.bind(memory)),
    consumeInviteCode: wrap(memory.consumeInviteCode.bind(memory)),
    _resetForTests() { memory._reset(); loaded = false; try { persist(); } catch (e) { if (e.code !== "ENOENT") throw e; } },
  };
}

const globalStore =
  globalThis.__moauthRegistrationConfigStore ||
  (process.env.NODE_ENV === "test" ? createMemoryStore() : createFileStore());
globalThis.__moauthRegistrationConfigStore = globalStore;

// --- Config exports ---
export function getRegistrationConfig() { return globalStore.getConfig(); }
export function setRegistrationConfig({ mode }, actor) {
  return globalStore.setConfig({ mode, updatedBy: actor?.sub || null });
}

// --- Invite code exports ---
export function listInviteCodes() { return globalStore.listInviteCodes(); }
export function createInviteCode({ maxUseCount, expiresAt }) {
  return globalStore.createInviteCode({ maxUseCount, expiresAt });
}
export function revokeInviteCode(code) { return globalStore.revokeInviteCode(code); }
export function getInviteCode(code) { return globalStore.getInviteCode(code); }
export function reserveInviteCode(code) { return globalStore.reserveInviteCode(code); }
export function releaseInviteCode(reservationId) { return globalStore.releaseInviteCode(reservationId); }
export function consumeInviteCode(reservationId, { userId, email }) {
  return globalStore.consumeInviteCode(reservationId, { userId, email });
}

export function resetRegistrationConfigForTests() { globalStore._resetForTests(); }
