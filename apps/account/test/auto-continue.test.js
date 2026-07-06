import assert from "node:assert/strict";
import test from "node:test";

import { getHandoffStore } from "../src/handoff/store.js";
import { tryAutoHandoffRedirect } from "../src/handoff/auto-continue.js";
import { createAccountSession } from "../src/session/account-session.js";

const origEnv = { ...process.env };

function withEnv(partial, fn) {
  return async () => {
    process.env = { ...origEnv, ...partial };
    try {
      getHandoffStore()._resetForTests?.();
      return await fn();
    } finally {
      process.env = { ...origEnv };
    }
  };
}

const zitadelEnv = {
  ZITADEL_ISSUER: "https://zitadel.example.com",
  ZITADEL_SERVICE_USER_TOKEN: "pat-test",
  ZITADEL_ORG_ID: "org-1",
  MOAUTH_CONNECT_PUBLIC_URL: "http://127.0.0.1:3000",
  MOAUTH_HANDOFF_INTERNAL_TOKEN: "handoff-secret",
};

test("tryAutoHandoffRedirect skips when requireLogin is true", async () => {
  const accountSession = createAccountSession({
    session: { sessionId: "sess-1", sessionToken: "tok-1" },
    sub: "user-1",
    loginName: "alice",
  });

  const redirectUrl = await tryAutoHandoffRedirect({
    authRequestId: "V2_flow",
    accountSession,
    requireLogin: true,
  });

  assert.equal(redirectUrl, null);
});

test(
  "tryAutoHandoffRedirect issues handoff when account session is active",
  withEnv(zitadelEnv, async () => {
    const accountSession = createAccountSession({
      session: { sessionId: "sess-existing", sessionToken: "tok-existing" },
      sub: "user-1",
      loginName: "alice",
      email: "alice@example.com",
      emailVerified: true,
    });

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
      throw new Error(`Unexpected fetch ${key}`);
    };

    const redirectUrl = await tryAutoHandoffRedirect(
      {
        authRequestId: "V2_flow",
        accountSession,
        requireLogin: false,
      },
      { fetch: fetchMock }
    );

    assert.match(redirectUrl, /\/login\/handoff\?code=/);
    assert.match(redirectUrl, /auth_request=V2_flow/);
  })
);