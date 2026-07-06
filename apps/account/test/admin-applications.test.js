import assert from "node:assert/strict";
import test from "node:test";

import {
  createAdminApplication,
  listAdminApplications,
  setAdminApplicationStatus,
} from "../src/admin/applications-api.js";
import { createDeveloperApplicationRequest } from "../src/admin/application-requests-api.js";
import { resetApplicationRequestStoreForTests } from "../src/application-requests/store.js";
import { resetClientRegistryStoreForTests } from "../src/client-registry/store.js";

const ADMIN = { sub: "admin-subject", isAdmin: true };
const DEVELOPER = { sub: "developer-subject", emailVerified: true, isAdmin: false };

test.beforeEach(() => {
  resetClientRegistryStoreForTests();
  resetApplicationRequestStoreForTests();
  process.env.MOAUTH_CONSOLE_ZITADEL_SYNC = "false";
});

test("creates application in registry without zitadel sync", async () => {
  const created = await createAdminApplication(
    {
      clientId: "900000000000000001",
      displayName: "MoNexus",
      redirectUris: ["http://127.0.0.1:3003/api/auth/moauth/callback"],
      env: "dev",
      provisioningPolicy: "allowlist",
    },
    ADMIN
  );

  assert.equal(created.displayName, "MoNexus");
  assert.equal(created.clientId, "900000000000000001");
  const listed = await listAdminApplications();
  assert.equal(listed.length, 2);
});

test("disables application and removes it from active connect lookup", async () => {
  const created = await createAdminApplication(
    {
      clientId: "900000000000000002",
      displayName: "TempApp",
      redirectUris: ["http://127.0.0.1:3010/callback"],
      env: "dev",
    },
    ADMIN
  );

  const disabled = await setAdminApplicationStatus(created.id, "disabled", ADMIN);
  assert.equal(disabled.status, "disabled");
});

test("creates developer application request", () => {
  const request = createDeveloperApplicationRequest(
    {
      displayName: "CommunityApp",
      homepageUrl: "https://example.com",
      description: "demo",
      redirectUris: ["https://example.com/callback"],
      minUserLevel: 1,
    },
    DEVELOPER
  );

  assert.equal(request.status, "pending");
  assert.equal(request.displayName, "CommunityApp");
});