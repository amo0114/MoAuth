import assert from "node:assert/strict";
import test from "node:test";

import { consumeHandoffFromAccount } from "../src/handoff/account-client.js";
import { buildAccountLoginUrl, buildConnectLoginUrl } from "../src/oidc/account-redirect.js";
import { buildAccountUrl } from "../src/ui/connect-urls.js";
import {
  createConnectSsoSession,
  readConnectSessionFromCookie,
  signConnectSession,
} from "../src/oidc/connect-session.js";
import { resetConnectSessionStoreForTests } from "../src/oidc/connect-session-store.js";

const origEnv = { ...process.env };

function withEnv(partial, fn) {
  return async () => {
    process.env = { ...origEnv, ...partial };
    try {
      return await fn();
    } finally {
      process.env = { ...origEnv };
    }
  };
}

test("buildConnectLoginUrl uses canonical Connect host for post-handoff redirect", withEnv({
  MOAUTH_CONNECT_PUBLIC_URL: "http://127.0.0.1:3000",
}, () => {
  const url = buildConnectLoginUrl("V2_flow");
  assert.equal(url, "http://127.0.0.1:3000/login?authRequest=V2_flow");
  assert.doesNotMatch(url, /localhost/);
}));

test("buildAccountLoginUrl carries auth_request to Account login", withEnv({
  MOAUTH_ACCOUNT_PUBLIC_URL: "http://127.0.0.1:3002",
  MOAUTH_CONNECT_PUBLIC_URL: "http://127.0.0.1:3000",
}, () => {
  const url = buildAccountLoginUrl("V2_flow");
  assert.match(url, /^http:\/\/127\.0\.0\.1:3002\/login\?/);
  assert.match(url, /auth_request=V2_flow/);
  assert.match(url, /return_to=/);
  assert.doesNotMatch(url, /require_login=/);
}));

test("buildAccountLoginUrl can force interactive login", withEnv({
  MOAUTH_ACCOUNT_PUBLIC_URL: "http://127.0.0.1:3002",
  MOAUTH_CONNECT_PUBLIC_URL: "http://127.0.0.1:3000",
}, () => {
  const url = buildAccountLoginUrl("V2_flow", { requireLogin: true });
  assert.match(url, /require_login=1/);
}));

test("buildAccountUrl uses injected public Account URL without build-time env", () => {
  const url = buildAccountUrl("/register", "V2_flow", {
    accountBaseUrl: "https://account.staging.example.com",
    returnTo: "https://connect.staging.example.com/login",
  });
  assert.equal(
    url,
    "https://account.staging.example.com/register?return_to=https%3A%2F%2Fconnect.staging.example.com%2Flogin&auth_request=V2_flow"
  );
});

test(
  "consumeHandoffFromAccount calls Account consume API with internal token",
  withEnv(
    {
      MOAUTH_ACCOUNT_PUBLIC_URL: "http://127.0.0.1:3002",
      MOAUTH_HANDOFF_INTERNAL_TOKEN: "handoff-secret",
    },
    async () => {
      const fetchMock = async (url, init) => {
        assert.equal(url, "http://127.0.0.1:3002/api/handoff/consume");
        assert.equal(init.headers.Authorization, "Bearer handoff-secret");
        const body = JSON.parse(init.body);
        assert.equal(body.code, "opaque-code");
        assert.equal(body.authRequestId, "V2_flow");
        return {
          ok: true,
          status: 200,
          json: async () => ({
            status: "HANDOFF_CONSUMED",
            payload: {
              sessionId: "sess-1",
              sessionToken: "tok-1",
              loginName: "alice",
              email: "alice@example.com",
              sub: "user-1",
            },
          }),
        };
      };

      const result = await consumeHandoffFromAccount(
        { code: "opaque-code", authRequestId: "V2_flow" },
        { fetch: fetchMock }
      );
      assert.equal(result.payload.loginName, "alice");
    }
  )
);

test("createConnectSsoSession stores credentials without authRequest binding", () => {
  resetConnectSessionStoreForTests();
  const now = new Date("2026-06-30T12:00:00.000Z");
  const session = createConnectSsoSession({
    session: { sessionId: "sess-1", sessionToken: "tok-1" },
    loginName: "alice",
    email: "alice@example.com",
    sub: "user-1",
    now,
  });
  const cookieValue = signConnectSession(session, "test-secret");
  assert.doesNotMatch(cookieValue, /tok-1/);
  const verified = readConnectSessionFromCookie(cookieValue, now, "test-secret");
  assert.equal(verified.sessionId, "sess-1");
  assert.equal(verified.email, "alice@example.com");
  assert.equal(verified.authRequestId, null);
});
