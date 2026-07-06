import assert from "node:assert/strict";
import test from "node:test";

import {
  listAuthorizedAppsForSub,
  recordAuthorizedAppGrant,
  revokeAuthorizedApp,
  toApplicationListResponse,
} from "../src/authorized-apps/service.js";
import { resetAuthorizedAppsStoreForTests } from "../src/authorized-apps/store.js";

const now = new Date("2026-06-30T12:00:00.000Z");

test("authorized apps service lists active grants for account sub", () => {
  resetAuthorizedAppsStoreForTests();
  recordAuthorizedAppGrant({
    sub: "user-1",
    clientId: "client-a",
    displayName: "App A",
    scopes: ["openid", "profile"],
  });

  const response = toApplicationListResponse(listAuthorizedAppsForSub("user-1"));
  assert.equal(response.status, "APPLICATION_LIST");
  assert.equal(response.applications.length, 1);
  assert.equal(response.applications[0].source, "consent_projection");
  assert.equal(response.applications[0].status, "authorized");
});

test("revoke removes grant from active application list", () => {
  resetAuthorizedAppsStoreForTests();
  recordAuthorizedAppGrant({
    sub: "user-1",
    clientId: "client-a",
    displayName: "App A",
    scopes: ["openid"],
  });
  revokeAuthorizedApp({ sub: "user-1", clientId: "client-a" });

  const response = toApplicationListResponse(listAuthorizedAppsForSub("user-1"));
  assert.equal(response.applications.length, 0);
});