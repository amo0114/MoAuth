import assert from "node:assert/strict";
import test from "node:test";

import {
  ACCOUNT_SESSION_COOKIE,
  createAccountSession,
  getSessionSecret,
  readAccountSessionFromCookie,
  revokeAccountSessionCookie,
  signAccountSession,
  toPublicAccountUser,
} from "../src/session/account-session.js";
import { resetAccountSessionStoreForTests } from "../src/session/account-session-store.js";
import {
  completeAccountLogin,
  completeStandaloneLogin,
} from "../src/handoff/service.js";

const SECRET = "account-test-secret";
const NOW = new Date("2026-06-30T12:00:00.000Z");
const origEnv = { ...process.env };

function withEnv(partial, fn) {
  return async () => {
    process.env = { ...origEnv, ...partial, MOAUTH_ACCOUNT_SESSION_SECRET: SECRET };
    resetAccountSessionStoreForTests();
    try {
      return await fn();
    } finally {
      process.env = { ...origEnv };
      resetAccountSessionStoreForTests();
    }
  };
}

function makeSession(overrides = {}) {
  return createAccountSession({
    session: { sessionId: "sess-1", sessionToken: "tok-secret" },
    sub: "user-1",
    loginName: "alice",
    email: "alice@example.com",
    emailVerified: true,
    now: NOW,
    ...overrides,
  });
}

test("account session cookie is opaque and round-trips", () => {
  resetAccountSessionStoreForTests();
  process.env.MOAUTH_ACCOUNT_SESSION_SECRET = SECRET;
  const session = makeSession();
  const cookieValue = signAccountSession(session, SECRET);
  assert.doesNotMatch(cookieValue, /tok-secret/);
  const verified = readAccountSessionFromCookie(cookieValue, NOW, SECRET);
  assert.equal(verified.loginName, "alice");
  assert.equal(verified.sessionToken, "tok-secret");
  process.env = { ...origEnv };
});

test("toPublicAccountUser omits sessionToken", () => {
  const user = toPublicAccountUser(makeSession());
  assert.equal(user.loginName, "alice");
  assert.equal("sessionToken" in user, false);
});

test("account session cookie survives without server-side session store", () => {
  resetAccountSessionStoreForTests();
  process.env.MOAUTH_ACCOUNT_SESSION_SECRET = SECRET;
  const cookieValue = signAccountSession(makeSession(), SECRET);
  const verified = readAccountSessionFromCookie(cookieValue, NOW, SECRET);
  assert.equal(verified.loginName, "alice");
  assert.equal(verified.sessionToken, "tok-secret");
  process.env = { ...origEnv };
});

test("revokeAccountSessionCookie is a no-op for stateless cookies", () => {
  const cookieValue = signAccountSession(makeSession(), SECRET);
  assert.doesNotThrow(() => revokeAccountSessionCookie(cookieValue, SECRET));
});

test("ACCOUNT_SESSION_COOKIE name is stable", () => {
  assert.equal(ACCOUNT_SESSION_COOKIE, "moauth_account_session");
});

test("account session secret is required in production", () => {
  process.env = { ...origEnv, NODE_ENV: "production" };
  delete process.env.MOAUTH_ACCOUNT_SESSION_SECRET;

  assert.throws(() => getSessionSecret(), {
    message: "MOAUTH_ACCOUNT_SESSION_SECRET is required in production.",
  });

  process.env = { ...origEnv };
});

test(
  "completeStandaloneLogin creates account session without authRequest",
  withEnv(
    {
      ZITADEL_ISSUER: "https://zitadel.example.com",
      ZITADEL_SERVICE_USER_TOKEN: "pat-test",
      ZITADEL_ORG_ID: "org-1",
      MOAUTH_ACCOUNT_PUBLIC_URL: "http://127.0.0.1:3002",
    },
    async () => {
      const fetchMock = async (url, init) => {
        const key = `${init?.method || "GET"} ${String(url)}`;
        if (key === "POST https://zitadel.example.com/v2/sessions") {
          return {
            ok: true,
            status: 200,
            text: async () =>
              JSON.stringify({
                sessionId: "sess-account",
                sessionToken: "tok-account",
                factors: {
                  user: {
                    id: "user-1",
                    loginName: "alice",
                    email: "alice@example.com",
                    emailVerified: true,
                  },
                },
              }),
            headers: new Headers(),
          };
        }
        throw new Error(`Unexpected fetch ${key}`);
      };

      const result = await completeStandaloneLogin(
        { loginName: "alice", password: "secret" },
        { fetch: fetchMock }
      );

      assert.equal(result.status, "ACCOUNT_SESSION_CREATED");
      assert.equal(result.redirectUrl, "http://127.0.0.1:3002/account/overview");
      assert.equal(result.user.loginName, "alice");
      assert.equal(result.accountSession.sessionId, "sess-account");
    }
  )
);

test(
  "completeAccountLogin routes to handoff when authRequest is present",
  withEnv(
    {
      ZITADEL_ISSUER: "https://zitadel.example.com",
      ZITADEL_SERVICE_USER_TOKEN: "pat-test",
      ZITADEL_ORG_ID: "org-1",
      MOAUTH_CONNECT_PUBLIC_URL: "http://127.0.0.1:3000",
      MOAUTH_HANDOFF_INTERNAL_TOKEN: "handoff-secret",
    },
    async () => {
      const fetchMock = async (url, init) => {
        const key = `${init?.method || "GET"} ${String(url)}`;
        if (key === "GET https://zitadel.example.com/v2/oidc/auth_requests/V2_flow") {
          return {
            ok: true,
            status: 200,
            text: async () =>
              JSON.stringify({
                authRequest: {
                  id: "V2_flow",
                  clientId: "subboost-dev",
                  redirectUri: "http://127.0.0.1:3001/cb",
                  scope: ["openid", "email"],
                },
              }),
            headers: new Headers(),
          };
        }
        if (key === "POST https://zitadel.example.com/v2/sessions") {
          return {
            ok: true,
            status: 200,
            text: async () =>
              JSON.stringify({
                sessionId: "sess-flow",
                sessionToken: "tok-flow",
                factors: {
                  user: {
                    id: "user-1",
                    loginName: "alice@example.com",
                    email: "alice@example.com",
                    emailVerified: true,
                  },
                },
              }),
            headers: new Headers(),
          };
        }
        throw new Error(`Unexpected fetch ${key}`);
      };

      const result = await completeAccountLogin(
        { authRequestId: "V2_flow", loginName: "alice@example.com", password: "hunter2" },
        { fetch: fetchMock }
      );

      assert.equal(result.status, "HANDOFF_ISSUED");
      assert.match(result.redirectUrl, /\/login\/handoff\?code=/);
    }
  )
);

test(
  "completeStandaloneLogin sets isAdmin when subject is in MOAUTH_ACCOUNT_ADMIN_SUBJECTS",
  withEnv(
    {
      ZITADEL_ISSUER: "https://zitadel.example.com",
      ZITADEL_SERVICE_USER_TOKEN: "pat-test",
      ZITADEL_ORG_ID: "org-1",
      MOAUTH_ACCOUNT_PUBLIC_URL: "http://127.0.0.1:3002",
      MOAUTH_ACCOUNT_ADMIN_SUBJECTS: "admin@moauth.local,user-admin-id",
    },
    async () => {
      const fetchMock = async (url, init) => {
        const key = `${init?.method || "GET"} ${String(url)}`;
        if (key === "POST https://zitadel.example.com/v2/sessions") {
          return {
            ok: true,
            status: 200,
            text: async () =>
              JSON.stringify({
                sessionId: "sess-admin",
                sessionToken: "tok-admin",
                factors: {
                  user: {
                    id: "user-admin-id",
                    loginName: "admin@moauth.local",
                    email: "admin@moauth.local",
                    emailVerified: true,
                  },
                },
              }),
            headers: new Headers(),
          };
        }
        throw new Error(`Unexpected fetch ${key}`);
      };

      const result = await completeStandaloneLogin(
        { loginName: "admin@moauth.local", password: "secret" },
        { fetch: fetchMock }
      );

      assert.equal(result.status, "ACCOUNT_SESSION_CREATED");
      assert.equal(result.user.isAdmin, true);
      assert.equal(result.accountSession.isAdmin, true);
    }
  )
);

test(
  "completeStandaloneLogin leaves isAdmin false for non-admin subject",
  withEnv(
    {
      ZITADEL_ISSUER: "https://zitadel.example.com",
      ZITADEL_SERVICE_USER_TOKEN: "pat-test",
      ZITADEL_ORG_ID: "org-1",
      MOAUTH_ACCOUNT_PUBLIC_URL: "http://127.0.0.1:3002",
      MOAUTH_ACCOUNT_ADMIN_SUBJECTS: "admin@moauth.local",
    },
    async () => {
      const fetchMock = async (url, init) => {
        const key = `${init?.method || "GET"} ${String(url)}`;
        if (key === "POST https://zitadel.example.com/v2/sessions") {
          return {
            ok: true,
            status: 200,
            text: async () =>
              JSON.stringify({
                sessionId: "sess-user",
                sessionToken: "tok-user",
                factors: {
                  user: {
                    id: "user-1",
                    loginName: "alice@example.com",
                    email: "alice@example.com",
                    emailVerified: true,
                  },
                },
              }),
            headers: new Headers(),
          };
        }
        throw new Error(`Unexpected fetch ${key}`);
      };

      const result = await completeStandaloneLogin(
        { loginName: "alice@example.com", password: "secret" },
        { fetch: fetchMock }
      );

      assert.equal(result.user.isAdmin, false);
      assert.equal(result.accountSession.isAdmin, false);
    }
  )
);
