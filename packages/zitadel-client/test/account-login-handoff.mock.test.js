import assert from "node:assert/strict";
import test from "node:test";

import {
  createPasswordSession,
  finalizeAuthRequest,
  getAuthRequest,
} from "../src/index.js";

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

function makeMockFetch(responses) {
  const fetchMock = async (url, init) => {
    const key = `${init?.method || "GET"} ${String(url)}`;
    const responder = responses[key];
    if (!responder) throw new Error(`Unexpected fetch ${key}`);
    const result = typeof responder === "function" ? responder(init) : responder;
    const status = result.status ?? 200;
    return {
      ok: status >= 200 && status < 300,
      status,
      text: async () => JSON.stringify(result.body || {}),
      headers: new Headers(),
    };
  };
  return { fetchMock };
}

const requiredEnv = {
  ZITADEL_ISSUER: "https://zitadel.example.com",
  ZITADEL_SERVICE_USER_TOKEN: "pat-test-token",
  ZITADEL_ORG_ID: "org-123",
};

test(
  "Account BFF mock: login then handoff payload fields for Connect consume",
  withEnv(requiredEnv, async () => {
    const authRequestId = "V2_handoff-flow";
    const { fetchMock } = makeMockFetch({
      [`GET https://zitadel.example.com/v2/oidc/auth_requests/${authRequestId}`]: {
        status: 200,
        body: {
          authRequest: {
            id: authRequestId,
            clientId: "subboost-dev",
            redirectUri: "http://127.0.0.1:3001/api/auth/moauth/callback",
            scope: ["openid", "profile", "email"],
          },
        },
      },
      "POST https://zitadel.example.com/v2/sessions": {
        status: 200,
        body: {
          sessionId: "sess-handoff",
          sessionToken: "tok-handoff",
          factors: { user: { loginName: "alice" } },
        },
      },
    });

    const { payload } = await getAuthRequest(authRequestId, { fetch: fetchMock });
    const authRequest = payload.authRequest;

    const session = await createPasswordSession(
      { loginName: "alice", password: "hunter2" },
      { fetch: fetchMock }
    );

    const handoffPayload = {
      version: 1,
      authRequestId,
      clientId: authRequest.clientId,
      redirectUri: authRequest.redirectUri,
      scopes: authRequest.scope,
      sub: "zitadel-user-id",
      loginName: "alice",
      email: "alice@example.com",
      emailVerified: true,
      sessionId: session.sessionId,
      sessionToken: session.sessionToken,
    };

    assert.equal(handoffPayload.sessionId, "sess-handoff");
    assert.equal(handoffPayload.sessionToken, "tok-handoff");
    assert.deepEqual(handoffPayload.scopes, ["openid", "profile", "email"]);
    assert.equal(handoffPayload.clientId, "subboost-dev");
  })
);

test(
  "Connect BFF mock: consume handoff payload then finalize auth request",
  withEnv(requiredEnv, async () => {
    const authRequestId = "V2_finalize";
    const handoffPayload = {
      sessionId: "sess-1",
      sessionToken: "tok-1",
    };

    const { fetchMock } = makeMockFetch({
      [`POST https://zitadel.example.com/v2/oidc/auth_requests/${authRequestId}`]: (init) => {
        const body = JSON.parse(init.body);
        assert.equal(body.session.sessionId, handoffPayload.sessionId);
        assert.equal(body.session.sessionToken, handoffPayload.sessionToken);
        return {
          status: 200,
          body: { callbackUrl: "http://127.0.0.1:3001/api/auth/moauth/callback?code=abc&state=xyz" },
        };
      },
    });

    const finalized = await finalizeAuthRequest(
      {
        authRequestId,
        sessionId: handoffPayload.sessionId,
        sessionToken: handoffPayload.sessionToken,
      },
      { fetch: fetchMock }
    );

    assert.match(finalized.callbackUrl, /code=abc/);
  })
);