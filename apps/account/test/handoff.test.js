import assert from "node:assert/strict";
import test from "node:test";

import { HANDOFF_ERROR_CODES } from "@moauth/handoff-store";

import { assertHandoffInternalAuth } from "../src/handoff/internal-auth.js";
import { buildHandoffPayload } from "../src/handoff/payload.js";
import {
  buildHandoffRedirectUrl,
  validateConnectReturnTo,
} from "../src/handoff/return-to.js";
import { getHandoffStore } from "../src/handoff/store.js";
import {
  completeHandoffFromAccountSession,
  completePasswordLogin,
  consumeHandoffCode,
  issueHandoffFromPayload,
} from "../src/handoff/service.js";
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

function makeMockFetch() {
  const fetchMock = async (url, init) => {
    const key = `${init?.method || "GET"} ${String(url)}`;
    if (key === "GET https://zitadel.example.com/v2/oidc/auth_requests/V2_flow") {
      return ok({
        authRequest: {
          id: "V2_flow",
          clientId: "subboost-dev",
          redirectUri: "http://127.0.0.1:3001/api/auth/moauth/callback",
          scope: ["openid", "profile", "email"],
        },
      });
    }
    if (key === "POST https://zitadel.example.com/v2/sessions") {
      return ok({
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
      });
    }
    throw new Error(`Unexpected fetch ${key}`);
  };
  return fetchMock;
}

function ok(body, status = 200) {
  return {
    ok: status >= 200 && status < 300,
    status,
    text: async () => JSON.stringify(body),
    headers: new Headers(),
  };
}

const zitadelEnv = {
  ZITADEL_ISSUER: "https://zitadel.example.com",
  ZITADEL_SERVICE_USER_TOKEN: "pat-test",
  ZITADEL_ORG_ID: "org-1",
  MOAUTH_CONNECT_PUBLIC_URL: "http://127.0.0.1:3000",
  MOAUTH_HANDOFF_INTERNAL_TOKEN: "handoff-secret",
};

test("validateConnectReturnTo allows connect login and handoff paths only", () => {
  const base = "http://127.0.0.1:3000";
  assert.equal(
    validateConnectReturnTo("http://127.0.0.1:3000/login?auth_request=V2_x", base),
    "http://127.0.0.1:3000/login?auth_request=V2_x"
  );
  assert.equal(
    validateConnectReturnTo("http://127.0.0.1:3000/login/handoff?code=abc", base),
    "http://127.0.0.1:3000/login/handoff?code=abc"
  );
  assert.equal(validateConnectReturnTo("https://evil.example/login", base), null);
  assert.equal(validateConnectReturnTo("http://127.0.0.1:3000/register", base), null);
});

test("buildHandoffRedirectUrl points to Connect handoff route", () => {
  const url = buildHandoffRedirectUrl({
    code: "opaque-code",
    authRequestId: "V2_flow",
    connectBaseUrl: "http://127.0.0.1:3000",
  });
  assert.equal(url, "http://127.0.0.1:3000/login/handoff?code=opaque-code&auth_request=V2_flow");
});

test("buildHandoffPayload maps auth request and session fields from Zitadel only", async () => {
  const payload = await buildHandoffPayload({
    authRequest: {
      authRequestId: "V2_flow",
      payload: {
        authRequest: {
          clientId: "subboost-dev",
          redirectUri: "http://127.0.0.1:3001/cb",
          scope: ["openid", "email"],
        },
      },
    },
    session: {
      sessionId: "sess-1",
      sessionToken: "tok-1",
      factors: {
        user: {
          id: "user-1",
          loginName: "alice@example.com",
          email: "alice@example.com",
          emailVerified: true,
        },
      },
      payload: {},
    },
  });

  assert.equal(payload.sub, "user-1");
  assert.equal(payload.clientId, "subboost-dev");
  assert.equal(payload.email, "alice@example.com");
  assert.equal(payload.emailVerified, true);
  assert.deepEqual(payload.scopes, ["openid", "email"]);
});

test(
  "buildHandoffPayload does not fabricate email or default emailVerified",
  withEnv({ ZITADEL_ISSUER: "", ZITADEL_SERVICE_USER_TOKEN: "" }, async () => {
  const payload = await buildHandoffPayload({
    authRequest: {
      authRequestId: "V2_flow",
      payload: {
        authRequest: {
          clientId: "subboost-dev",
          redirectUri: "http://127.0.0.1:3001/cb",
          scope: ["openid", "profile"],
        },
      },
    },
    session: {
      sessionId: "sess-1",
      sessionToken: "tok-1",
      factors: { user: { id: "user-1", loginName: "alice" } },
      payload: {},
    },
  });

  assert.equal(payload.email, null);
  assert.equal(payload.emailVerified, false);
  })
);

test(
  "buildHandoffPayload enriches email from Zitadel profile when session omits it",
  withEnv(zitadelEnv, async () => {
    const fetchMock = async (url, init) => {
      const key = `${init?.method || "GET"} ${String(url)}`;
      if (key === "GET https://zitadel.example.com/management/v1/users/user-1") {
        return ok({
          user: {
            id: "user-1",
            preferredLoginName: "alice",
            human: {
              email: { email: "alice@example.com", isEmailVerified: true },
            },
          },
        });
      }
      throw new Error(`Unexpected fetch ${key}`);
    };

    const payload = await buildHandoffPayload(
      {
        authRequest: {
          authRequestId: "V2_flow",
          payload: {
            authRequest: {
              clientId: "subboost-dev",
              redirectUri: "http://127.0.0.1:3001/cb",
              scope: ["openid", "email"],
            },
          },
        },
        session: {
          sessionId: "sess-1",
          sessionToken: "tok-1",
          factors: { user: { id: "user-1" } },
          payload: {},
        },
      },
      { fetch: fetchMock }
    );

    assert.equal(payload.email, "alice@example.com");
    assert.equal(payload.loginName, "alice");
    assert.equal(payload.emailVerified, true);
  })
);

test(
  "completePasswordLogin issues handoff and returns Connect redirect",
  withEnv(zitadelEnv, async () => {
    const result = await completePasswordLogin(
      {
        authRequestId: "V2_flow",
        loginName: "alice@example.com",
        password: "hunter2",
      },
      { fetch: makeMockFetch() }
    );

    assert.equal(result.status, "HANDOFF_ISSUED");
    assert.match(result.redirectUrl, /\/login\/handoff\?code=/);
    assert.match(result.redirectUrl, /auth_request=V2_flow/);
  })
);

test(
  "completeHandoffFromAccountSession issues handoff without re-entering password",
  withEnv(
    {
      ...zitadelEnv,
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
        throw new Error(`Unexpected fetch ${key}`);
      };

      const accountSession = createAccountSession({
        session: { sessionId: "sess-existing", sessionToken: "tok-existing" },
        sub: "user-1",
        loginName: "alice",
        email: "alice@example.com",
        emailVerified: true,
      });

      const result = await completeHandoffFromAccountSession(
        { authRequestId: "V2_flow", accountSession },
        { fetch: fetchMock }
      );

      assert.equal(result.status, "HANDOFF_ISSUED");
      assert.match(result.redirectUrl, /auth_request=V2_flow/);
      assert.equal(result.payload.sessionToken, "tok-existing");
    }
  )
);

test(
  "consumeHandoffCode requires internal auth and returns payload once",
  withEnv(zitadelEnv, async () => {
    const issued = issueHandoffFromPayload({
      authRequestId: "V2_flow",
      clientId: "subboost-dev",
      redirectUri: "http://127.0.0.1:3001/cb",
      scopes: ["openid"],
      sub: "user-1",
      loginName: "alice",
      email: "alice@example.com",
      emailVerified: true,
      sessionId: "sess-1",
      sessionToken: "tok-1",
    });

    const consumed = consumeHandoffCode({ code: issued.code, authRequestId: "V2_flow" });
    assert.equal(consumed.payload.sessionToken, "tok-1");

    assert.throws(
      () => consumeHandoffCode({ code: issued.code, authRequestId: "V2_flow" }),
      { code: HANDOFF_ERROR_CODES.HANDOFF_ALREADY_CONSUMED }
    );
  })
);

test("assertHandoffInternalAuth rejects missing or invalid bearer token", withEnv(zitadelEnv, () => {
  const request = {
    headers: {
      get(name) {
        if (name === "authorization") return "Bearer wrong";
        return null;
      },
    },
  };

  assert.throws(() => assertHandoffInternalAuth(request), {
    code: HANDOFF_ERROR_CODES.HANDOFF_UNAUTHORIZED,
  });
}));