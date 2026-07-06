import assert from "node:assert/strict";
import { mkdtemp, readFile, readdir } from "node:fs/promises";
import { existsSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";

import { createFileAuthorizedAppsStore } from "../src/file-store.js";

const now = new Date("2026-06-30T12:00:00.000Z");

test("file store persists grants and survives reload", async () => {
  const dir = await mkdtemp(path.join(os.tmpdir(), "moauth-authorized-apps-"));
  const filePath = path.join(dir, "authorized-apps.json");
  const store = createFileAuthorizedAppsStore({ now: () => now, filePath });
  store.grant({
    sub: "user-1",
    clientId: "client-a",
    displayName: "App A",
    scopes: ["openid", "profile"],
  });

  const reloaded = createFileAuthorizedAppsStore({ now: () => now, filePath });
  assert.equal(
    reloaded.isGranted({ sub: "user-1", clientId: "client-a", scopes: ["openid", "profile"] }),
    true
  );

  const raw = JSON.parse(await readFile(filePath, "utf8"));
  assert.equal(raw.version, 1);
  assert.ok(raw.records["user-1:client-a"]);
});

test("file store keeps scope subset consent semantics", async () => {
  const dir = await mkdtemp(path.join(os.tmpdir(), "moauth-authorized-apps-"));
  const filePath = path.join(dir, "authorized-apps.json");
  const store = createFileAuthorizedAppsStore({ now: () => now, filePath });
  store.grant({
    sub: "user-1",
    clientId: "client-a",
    displayName: "App A",
    scopes: ["openid", "profile", "email"],
  });

  assert.equal(
    store.isGranted({ sub: "user-1", clientId: "client-a", scopes: ["openid", "profile"] }),
    true
  );
  assert.equal(
    store.isGranted({ sub: "user-1", clientId: "client-a", scopes: ["openid", "offline_access"] }),
    false
  );
});

test("file store creates parent directories without fixed temp file leftovers", async () => {
  const dir = await mkdtemp(path.join(os.tmpdir(), "moauth-authorized-apps-"));
  const filePath = path.join(dir, "nested", "authorized-apps.json");
  const store = createFileAuthorizedAppsStore({ now: () => now, filePath });

  store.grant({
    sub: "user-1",
    clientId: "client-a",
    displayName: "App A",
    scopes: ["openid"],
  });

  assert.equal(existsSync(filePath), true);
  assert.equal(existsSync(`${filePath}.tmp`), false);
  assert.deepEqual(
    (await readdir(path.dirname(filePath))).filter((name) => name.endsWith(".tmp")),
    []
  );
});
