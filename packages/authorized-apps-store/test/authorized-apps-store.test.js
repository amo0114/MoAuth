import assert from "node:assert/strict";
import test from "node:test";

import {
  AUTHORIZED_APPS_ERROR_CODES,
  AuthorizedAppsError,
  createMemoryAuthorizedAppsStore,
} from "../src/index.js";

const now = new Date("2026-06-30T12:00:00.000Z");

test("grant and list active authorized apps by sub", () => {
  const store = createMemoryAuthorizedAppsStore({ now: () => now });
  store.grant({
    sub: "user-1",
    clientId: "client-a",
    displayName: "App A",
    scopes: ["email", "openid", "profile"],
  });

  const apps = store.listBySub("user-1");
  assert.equal(apps.length, 1);
  assert.equal(apps[0].clientId, "client-a");
  assert.deepEqual(apps[0].scopes, ["email", "openid", "profile"]);
  assert.equal(apps[0].revokedAt, null);
});

test("grant replaces prior record for same sub and client", () => {
  const store = createMemoryAuthorizedAppsStore({ now: () => now });
  store.grant({
    sub: "user-1",
    clientId: "client-a",
    displayName: "App A",
    scopes: ["openid"],
  });
  store.grant({
    sub: "user-1",
    clientId: "client-a",
    displayName: "App A",
    scopes: ["openid", "profile"],
  });

  const apps = store.listBySub("user-1");
  assert.equal(apps.length, 1);
  assert.deepEqual(apps[0].scopes, ["openid", "profile"]);
});

test("isGranted requires active grant to cover requested scopes", () => {
  const store = createMemoryAuthorizedAppsStore({ now: () => now });
  store.grant({
    sub: "user-1",
    clientId: "client-a",
    displayName: "App A",
    scopes: ["openid", "profile"],
  });

  assert.equal(
    store.isGranted({ sub: "user-1", clientId: "client-a", scopes: ["openid", "profile"] }),
    true
  );
  assert.equal(
    store.isGranted({ sub: "user-1", clientId: "client-a", scopes: ["openid", "email"] }),
    false
  );
});

test("revoke removes app from active list and blocks isGranted", () => {
  const store = createMemoryAuthorizedAppsStore({ now: () => now });
  store.grant({
    sub: "user-1",
    clientId: "client-a",
    displayName: "App A",
    scopes: ["openid"],
  });
  store.revoke({ sub: "user-1", clientId: "client-a" });

  assert.equal(store.listBySub("user-1").length, 0);
  assert.equal(store.isGranted({ sub: "user-1", clientId: "client-a", scopes: ["openid"] }), false);
  assert.throws(
    () => store.revoke({ sub: "user-1", clientId: "client-a" }),
    (error) => {
      assert.ok(error instanceof AuthorizedAppsError);
      assert.equal(error.code, AUTHORIZED_APPS_ERROR_CODES.AUTHORIZED_APPS_ALREADY_REVOKED);
      return true;
    }
  );
});