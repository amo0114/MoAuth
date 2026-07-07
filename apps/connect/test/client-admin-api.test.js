import assert from "node:assert/strict";
import test from "node:test";

import { resetClientRegistryStoreForTests } from "../src/client-registry/store.js";
import { findClientById } from "../src/config/clients.js";

const origEnv = { ...process.env };
const ADMIN_TOKEN = "connect-admin-test-token";

function restoreEnv() {
  process.env = { ...origEnv, NODE_ENV: "test" };
}

function adminHeaders(extra = {}) {
  return {
    Authorization: `Bearer ${ADMIN_TOKEN}`,
    ...extra,
  };
}

function jsonRequest(url, body, init = {}) {
  return new Request(url, {
    method: init.method || "POST",
    headers: {
      "Content-Type": "application/json",
      ...(init.headers || {}),
    },
    body: JSON.stringify(body),
  });
}

const LOCAL_CLIENT = Object.freeze({
  clientId: "subboost-local-poc",
  displayName: "SubBoost Local PoC",
  clientType: "confidential",
  redirectUris: ["http://127.0.0.1:3001/api/auth/moauth/callback"],
  allowedScopes: ["openid", "profile", "email"],
  allowedPrompts: ["login", "select_account", "consent"],
  provisioningPolicy: "allowlist",
  env: "dev",
  status: "active",
});

test.beforeEach(() => {
  restoreEnv();
  process.env.MOAUTH_CONNECT_ADMIN_API_TOKEN = ADMIN_TOKEN;
  resetClientRegistryStoreForTests();
});

test.after(() => {
  process.env = origEnv;
});

test("Connect admin clients API fails closed when token is not configured", async () => {
  delete process.env.MOAUTH_CONNECT_ADMIN_API_TOKEN;
  const { GET } = await import("../app/api/admin/clients/route.js");

  const response = await GET(new Request("http://127.0.0.1:3000/api/admin/clients"));
  const body = await response.json();

  assert.equal(response.status, 503);
  assert.equal(body.error.code, "CONNECT_ADMIN_API_NOT_CONFIGURED");
});

test("Connect admin clients API rejects missing bearer token", async () => {
  const { GET } = await import("../app/api/admin/clients/route.js");

  const response = await GET(new Request("http://127.0.0.1:3000/api/admin/clients"));
  const body = await response.json();

  assert.equal(response.status, 401);
  assert.equal(body.error.code, "CONNECT_ADMIN_UNAUTHORIZED");
});

test("Connect admin clients API registers and lists an OIDC client", async () => {
  const { GET, POST } = await import("../app/api/admin/clients/route.js");

  const createdResponse = await POST(
    jsonRequest("http://127.0.0.1:3000/api/admin/clients", LOCAL_CLIENT, {
      headers: adminHeaders(),
    })
  );
  const createdBody = await createdResponse.json();

  assert.equal(createdResponse.status, 201);
  assert.equal(createdBody.client.clientId, LOCAL_CLIENT.clientId);
  assert.equal(createdBody.client.provisioningPolicy, "allowlist");
  assert.equal(createdBody.client.connectIssuer, "http://127.0.0.1:3000");
  assert.equal(findClientById(LOCAL_CLIENT.clientId)?.displayName, LOCAL_CLIENT.displayName);

  const listResponse = await GET(
    new Request("http://127.0.0.1:3000/api/admin/clients?status=active", {
      headers: adminHeaders(),
    })
  );
  const listBody = await listResponse.json();
  const clientIds = listBody.clients.map((client) => client.clientId);

  assert.equal(listResponse.status, 200);
  assert.ok(clientIds.includes(LOCAL_CLIENT.clientId));
});

test("Connect admin client detail API reads, updates, and disables by clientId", async () => {
  const collection = await import("../app/api/admin/clients/route.js");
  const detail = await import("../app/api/admin/clients/[clientId]/route.js");

  await collection.POST(
    jsonRequest("http://127.0.0.1:3000/api/admin/clients", LOCAL_CLIENT, {
      headers: adminHeaders(),
    })
  );

  const context = { params: { clientId: LOCAL_CLIENT.clientId } };
  const getResponse = await detail.GET(
    new Request(`http://127.0.0.1:3000/api/admin/clients/${LOCAL_CLIENT.clientId}`, {
      headers: adminHeaders(),
    }),
    context
  );
  const getBody = await getResponse.json();
  assert.equal(getBody.client.displayName, LOCAL_CLIENT.displayName);

  const patchResponse = await detail.PATCH(
    jsonRequest(
      `http://127.0.0.1:3000/api/admin/clients/${LOCAL_CLIENT.clientId}`,
      { displayName: "SubBoost Local Updated" },
      { method: "PATCH", headers: adminHeaders() }
    ),
    context
  );
  const patchBody = await patchResponse.json();

  assert.equal(patchResponse.status, 200);
  assert.equal(patchBody.client.displayName, "SubBoost Local Updated");
  assert.equal(findClientById(LOCAL_CLIENT.clientId)?.displayName, "SubBoost Local Updated");

  const deleteResponse = await detail.DELETE(
    new Request(`http://127.0.0.1:3000/api/admin/clients/${LOCAL_CLIENT.clientId}`, {
      method: "DELETE",
      headers: adminHeaders(),
    }),
    context
  );
  const deleteBody = await deleteResponse.json();

  assert.equal(deleteResponse.status, 200);
  assert.equal(deleteBody.client.status, "disabled");
  assert.equal(findClientById(LOCAL_CLIENT.clientId), null);
});
