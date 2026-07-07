import assert from "node:assert/strict";
import { existsSync, mkdtempSync, readdirSync, readFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";

import {
  CLIENT_REGISTRY_ERROR_CODES,
  ClientRegistryError,
  createFileClientRegistryStore,
  createMemoryClientRegistryStore,
} from "../src/index.js";

const SUBBOOST = {
  id: "seed-subboost",
  clientId: "380559739236450307",
  displayName: "SubBoost",
  clientType: "confidential",
  redirectUris: ["http://127.0.0.1:3001/api/auth/moauth/callback"],
  allowedScopes: ["openid", "profile", "email"],
  allowedPrompts: ["login", "select_account", "consent"],
  provisioningPolicy: "allowlist",
  env: "dev",
  status: "active",
};

test("creates and lists active connect clients", () => {
  const store = createMemoryClientRegistryStore({
    now: () => new Date("2026-07-02T00:00:00.000Z"),
  });
  store.create(SUBBOOST);
  const clients = store.listActiveConnectClients({ allowLoopbackHttp: true });
  assert.equal(clients.length, 1);
  assert.equal(clients[0].clientId, SUBBOOST.clientId);
  assert.equal(clients[0].displayName, "SubBoost");
});

test("exposes client onboarding aliases", () => {
  const store = createMemoryClientRegistryStore({
    now: () => new Date("2026-07-02T00:00:00.000Z"),
  });
  const created = store.registerClient(SUBBOOST);

  assert.equal(created.clientId, SUBBOOST.clientId);
  assert.equal(store.getClient(SUBBOOST.clientId)?.id, SUBBOOST.id);
  assert.deepEqual(
    store.listClients().map((client) => client.clientId),
    [SUBBOOST.clientId]
  );
});

test("rejects production loopback redirect URIs", () => {
  const store = createMemoryClientRegistryStore();
  assert.throws(
    () =>
      store.create({
        ...SUBBOOST,
        id: "prod-bad",
        clientId: "111",
        env: "prod",
        redirectUris: ["http://127.0.0.1:3003/callback"],
      }),
    (error) => error instanceof ClientRegistryError && error.code === CLIENT_REGISTRY_ERROR_CODES.CLIENT_REGISTRY_ENV_VIOLATION
  );
});

test("disabled clients are excluded from connect lookup", () => {
  const store = createMemoryClientRegistryStore();
  const created = store.create(SUBBOOST);
  store.disable(created.id);
  assert.equal(store.findActiveConnectClient(SUBBOOST.clientId, { allowLoopbackHttp: true }), null);
});

test("file store persists records", () => {
  const dir = mkdtempSync(path.join(os.tmpdir(), "moauth-client-registry-"));
  const filePath = path.join(dir, "clients.json");
  const store = createFileClientRegistryStore({
    filePath,
    now: () => new Date("2026-07-02T00:00:00.000Z"),
  });
  store.create(SUBBOOST);
  const raw = JSON.parse(readFileSync(filePath, "utf8"));
  assert.equal(raw.records[SUBBOOST.id].clientId, SUBBOOST.clientId);

  const reloaded = createFileClientRegistryStore({ filePath });
  assert.equal(reloaded.getByClientId(SUBBOOST.clientId)?.displayName, "SubBoost");
});

test("file store creates parent directories without fixed temp file leftovers", () => {
  const dir = mkdtempSync(path.join(os.tmpdir(), "moauth-client-registry-"));
  const filePath = path.join(dir, "nested", "clients.json");
  const store = createFileClientRegistryStore({ filePath });

  store.create({ ...SUBBOOST, id: "nested-client", clientId: "nested-client" });

  assert.equal(existsSync(filePath), true);
  assert.equal(existsSync(`${filePath}.tmp`), false);
  assert.deepEqual(
    readdirSync(path.dirname(filePath)).filter((name) => name.endsWith(".tmp")),
    []
  );
});
