import assert from "node:assert/strict";
import http from "node:http";
import test from "node:test";
import { clearAuthRequestCache, setCachedAuthRequest } from "@moauth/zitadel-client";
import { AUTHORIZED_APPS_ERROR_CODES } from "@moauth/authorized-apps-store";

import { resetAccountHealthCache } from "../src/account/account-availability.js";
import { resolveConsentPost } from "../src/oidc/consent-flow.js";
import {
  createConnectSsoSession,
  signConnectSession,
} from "../src/oidc/connect-session.js";
import { resetConnectSessionStoreForTests } from "../src/oidc/connect-session-store.js";

const origEnv = { ...process.env };
const AUTH_REQUEST_ID = "V2_consent-flow";
const CLIENT_ID = "380559739236450307";

test.afterEach(() => {
  process.env = { ...origEnv };
  clearAuthRequestCache();
  resetAccountHealthCache();
  resetConnectSessionStoreForTests();
});

test("consent allow returns 503 and does not finalize when authorized-app grant is unavailable", async () => {
  const account = await startAccountServer({
    grantResponse: {
      status: 503,
      body: {
        error: {
          code: AUTHORIZED_APPS_ERROR_CODES.AUTHORIZED_APPS_UNAVAILABLE,
          message: "Authorized apps projection is unavailable.",
        },
      },
    },
  });
  const zitadel = await startZitadelServer();

  try {
    configureEnv({ accountUrl: account.url, zitadelUrl: zitadel.url });
    seedAuthRequestCache();

    const result = await resolveConsentPost(makeConsentInput());

    assert.equal(result.status, 503);
    assert.equal(result.body.error.code, AUTHORIZED_APPS_ERROR_CODES.AUTHORIZED_APPS_UNAVAILABLE);
    assert.equal(account.grantCalls(), 1);
    assert.equal(zitadel.finalizeCalls(), 0);
  } finally {
    await Promise.all([account.close(), zitadel.close()]);
  }
});

test("consent allow records grant before finalizing auth request", async () => {
  const callOrder = [];
  const account = await startAccountServer({
    grantResponse: {
      status: 200,
      body: { status: "AUTHORIZED_APP_RECORDED" },
    },
    onGrant: () => callOrder.push("grant"),
  });
  const zitadel = await startZitadelServer({
    onFinalize: () => callOrder.push("finalize"),
  });

  try {
    configureEnv({ accountUrl: account.url, zitadelUrl: zitadel.url });
    seedAuthRequestCache();

    const result = await resolveConsentPost(makeConsentInput());

    assert.equal(result.status, 200);
    assert.equal(result.body.status, "AUTH_REQUEST_FINALIZED");
    assert.match(result.body.callbackUrl, /^http:\/\/127\.0\.0\.1:3001\/api\/auth\/moauth\/callback\?/);
    assert.deepEqual(callOrder.slice(0, 2), ["grant", "finalize"]);
    assert.equal(account.grantCalls(), 1);
    assert.equal(zitadel.finalizeCalls(), 1);
  } finally {
    await Promise.all([account.close(), zitadel.close()]);
  }
});

function configureEnv({ accountUrl, zitadelUrl }) {
  process.env = {
    ...origEnv,
    ZITADEL_ISSUER: zitadelUrl,
    ZITADEL_SERVICE_USER_TOKEN: "service-token",
    MOAUTH_ACCOUNT_PUBLIC_URL: accountUrl,
    MOAUTH_ACCOUNT_INTERNAL_URL: accountUrl,
    MOAUTH_HANDOFF_INTERNAL_TOKEN: "handoff-secret",
    MOAUTH_CONNECT_SESSION_SECRET: "connect-session-secret",
  };
}

function seedAuthRequestCache() {
  clearAuthRequestCache();
  setCachedAuthRequest(AUTH_REQUEST_ID, {
    authRequestId: AUTH_REQUEST_ID,
    payload: {
      authRequest: {
        id: AUTH_REQUEST_ID,
        clientId: CLIENT_ID,
        redirectUri: "http://127.0.0.1:3001/api/auth/moauth/callback",
        scope: ["openid", "profile", "email"],
        state: "state-from-auth-request",
      },
    },
  });
}

function makeConsentInput() {
  resetConnectSessionStoreForTests();
  const session = createConnectSsoSession({
    session: { sessionId: "sess-1", sessionToken: "tok-1" },
    loginName: "alice@example.com",
    email: "alice@example.com",
    sub: "user-1",
  });
  return {
    body: { authRequest: AUTH_REQUEST_ID, action: "allow" },
    cookieValue: signConnectSession(session),
  };
}

async function startAccountServer({ grantResponse, onGrant = () => {} }) {
  let grantCount = 0;
  const server = http.createServer(async (request, response) => {
    if (request.method === "GET" && request.url === "/api/health/ready") {
      sendJson(response, 200, { ok: true, service: "account" });
      return;
    }
    if (request.method === "POST" && request.url === "/api/internal/authorized-apps") {
      grantCount += 1;
      onGrant();
      await readRequestBody(request);
      sendJson(response, grantResponse.status, grantResponse.body);
      return;
    }
    if (request.method === "POST" && request.url === "/api/internal/audit-events") {
      await readRequestBody(request);
      sendJson(response, 200, { status: "AUDIT_EVENT_RECORDED" });
      return;
    }
    sendJson(response, 404, { error: { code: "NOT_FOUND" } });
  });
  const url = await listen(server);
  return {
    url,
    grantCalls: () => grantCount,
    close: () => close(server),
  };
}

async function startZitadelServer({ onFinalize = () => {} } = {}) {
  let finalizeCount = 0;
  const server = http.createServer(async (request, response) => {
    if (
      request.method === "POST" &&
      request.url === `/v2/oidc/auth_requests/${encodeURIComponent(AUTH_REQUEST_ID)}`
    ) {
      finalizeCount += 1;
      onFinalize();
      await readRequestBody(request);
      sendJson(response, 200, {
        callbackUrl: "http://127.0.0.1:3001/api/auth/moauth/callback?code=code-1",
      });
      return;
    }
    sendJson(response, 404, { error: { code: "NOT_FOUND" } });
  });
  const url = await listen(server);
  return {
    url,
    finalizeCalls: () => finalizeCount,
    close: () => close(server),
  };
}

function listen(server) {
  return new Promise((resolve, reject) => {
    server.once("error", reject);
    server.listen(0, "127.0.0.1", () => {
      const address = server.address();
      resolve(`http://127.0.0.1:${address.port}`);
    });
  });
}

function close(server) {
  return new Promise((resolve, reject) => {
    server.close((error) => (error ? reject(error) : resolve()));
  });
}

function sendJson(response, status, body) {
  response.writeHead(status, { "Content-Type": "application/json" });
  response.end(JSON.stringify(body));
}

function readRequestBody(request) {
  return new Promise((resolve, reject) => {
    let body = "";
    request.setEncoding("utf8");
    request.on("data", (chunk) => {
      body += chunk;
    });
    request.on("end", () => resolve(body));
    request.on("error", reject);
  });
}
