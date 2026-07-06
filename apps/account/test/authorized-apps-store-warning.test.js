import assert from "node:assert/strict";
import test from "node:test";

import {
  FILE_STORE_PRODUCTION_WARNING,
  resolveAuthorizedAppsStoreBackend,
  warnIfProductionFileStore,
} from "../src/authorized-apps/store.js";

test("resolveAuthorizedAppsStoreBackend uses memory in test runtime by default", () => {
  assert.equal(resolveAuthorizedAppsStoreBackend({ NODE_ENV: "test" }), "memory");
});

test("resolveAuthorizedAppsStoreBackend uses file in production when unset", () => {
  assert.equal(resolveAuthorizedAppsStoreBackend({ NODE_ENV: "production" }), "file");
});

test("warnIfProductionFileStore emits warning only for production file backend", () => {
  const warnings = [];
  const originalWarn = console.warn;
  console.warn = (message) => warnings.push(String(message));

  try {
    assert.equal(
      warnIfProductionFileStore({ NODE_ENV: "production", MOAUTH_AUTHORIZED_APPS_STORE: "file" }),
      true
    );
    assert.equal(warnings.length, 1);
    assert.match(warnings[0], /single-instance MVP only/);

    warnings.length = 0;
    assert.equal(
      warnIfProductionFileStore({ NODE_ENV: "production", MOAUTH_AUTHORIZED_APPS_STORE: "memory" }),
      false
    );
    assert.equal(warnings.length, 0);

    warnings.length = 0;
    assert.equal(warnIfProductionFileStore({ NODE_ENV: "test", MOAUTH_AUTHORIZED_APPS_STORE: "file" }), false);
    assert.equal(warnings.length, 0);
  } finally {
    console.warn = originalWarn;
  }
});

test("FILE_STORE_PRODUCTION_WARNING documents migration path", () => {
  assert.match(FILE_STORE_PRODUCTION_WARNING, /MOAUTH_AUTHORIZED_APPS_STORE=db/);
});