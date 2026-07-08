import assert from "node:assert/strict";
import test from "node:test";

import {
  ZITADEL_ERROR_CODES,
  buildZitadelFetch,
  createPasswordSession,
  finalizeAuthRequest,
  getAuthRequest,
  hydratePasswordSession,
  getZitadelConfig,
  isAuthRequestId,
  assertAuthRequestId,
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
  const calls = [];
  const fetchMock = async (url, init) => {
    calls.push({ url: String(url), init });
    const key = `${init?.method || "GET"} ${String(url)}`;
    const responder = responses[key] || responses[String(url)];
    if (!responder) throw new Error(`Unexpected fetch ${key}`);
    const result = typeof responder === "function" ? responder(init) : responder;
    const status = typeof result === "object" && "status" in result ? result.status : 200;
    return {
      ok: status >= 200 && status < 300,
      status,
      text: async () => (typeof result.body === "string" ? result.body : JSON.stringify(result.body || {})),
      headers: new Headers(),
    };
  };
  return { fetchMock, calls };
}

const requiredEnv = {
  ZITADEL_API_BASE: "https://zitadel.example.com",
  ZITADEL_ISSUER: "https://zitadel.example.com",
  ZITADEL_SERVICE_USER_TOKEN: "pat-test-token",
  ZITADEL_ORG_ID: "org-123",
};

test("getZitadelConfig throws when ISSUER or SERVICE_USER_TOKEN missing (fail-closed)", () => {
  process.env = { ...origEnv };
  delete process.env.ZITADEL_ISSUER;
  delete process.env.ZITADEL_SERVICE_USER_TOKEN;
  assert.throws(() => getZitadelConfig(), { code: ZITADEL_ERROR_CODES.ZITADEL_NOT_CONFIGURED });

  process.env = { ...origEnv };
  process.env.ZITADEL_ISSUER = "https://id.example.com";
  delete process.env.ZITADEL_SERVICE_USER_TOKEN;
  assert.throws(() => getZitadelConfig(), { code: ZITADEL_ERROR_CODES.ZITADEL_NOT_CONFIGURED });
  process.env = { ...origEnv };
});

test("getZitadelConfig falls back API_BASE to ISSUER when API_BASE unset", () => {
  process.env = { ...origEnv };
  delete process.env.ZITADEL_API_BASE;
  process.env.ZITADEL_ISSUER = "https://id.example.com";
  process.env.ZITADEL_SERVICE_USER_TOKEN = "tok";
  const config = getZitadelConfig();
  assert.equal(config.apiBase, "https://id.example.com");
  assert.equal(config.issuer, "https://id.example.com");
  process.env = { ...origEnv };
});

test("buildZitadelFetch sets Host from issuer when API_BASE is internal", async () => {
  process.env = { ...origEnv };
  process.env.ZITADEL_ISSUER = "https://id.example.com";
  process.env.ZITADEL_API_BASE = "http://zitadel:8080";
  process.env.ZITADEL_SERVICE_USER_TOKEN = "tok";
  const config = getZitadelConfig();
  const { fetchMock, calls } = makeMockFetch({
    "GET http://zitadel:8080/v2/sessions/test": { status: 200, body: {} },
  });
  const fetcher = buildZitadelFetch(config, fetchMock);
  await fetcher("/v2/sessions/test", { method: "GET" });
  assert.equal(calls[0].init.headers.get("Host"), "id.example.com");
  process.env = { ...origEnv };
});

test("getZitadelConfig allows internal API_BASE with public ISSUER for Docker proxying", () => {
  process.env = { ...origEnv };
  process.env.ZITADEL_ISSUER = "https://id.example.com";
  process.env.ZITADEL_API_BASE = "http://zitadel:8080";
  process.env.ZITADEL_SERVICE_USER_TOKEN = "tok";
  const config = getZitadelConfig();
  assert.equal(config.issuer, "https://id.example.com");
  assert.equal(config.apiBase, "http://zitadel:8080");
  process.env = { ...origEnv };
});

test("isAuthRequestId only accepts V2_ prefixed ids", () => {
  assert.equal(isAuthRequestId("V2_abcdef"), true);
  assert.equal(isAuthRequestId("V1_abcdef"), false);
  assert.equal(isAuthRequestId(""), false);
  assert.equal(isAuthRequestId(null), false);
});

test("assertAuthRequestId rejects malformed ids", () => {
  assert.throws(() => assertAuthRequestId("not-a-v2-id"), {
    code: ZITADEL_ERROR_CODES.ZITADEL_AUTH_REQUEST_NOT_FOUND,
  });
  assert.equal(assertAuthRequestId("V2_real-id"), "V2_real-id");
});

test("getAuthRequest returns payload for valid id", withEnv(requiredEnv, async () => {
  const { fetchMock, calls } = makeMockFetch({
    "GET https://zitadel.example.com/v2/oidc/auth_requests/V2_real-id": {
      status: 200,
      body: { authRequest: { id: "V2_real-id" } },
    },
  });

  const result = await getAuthRequest("V2_real-id", { fetch: fetchMock });
  assert.equal(result.authRequestId, "V2_real-id");
  assert.deepEqual(calls[0].init.headers.get("Authorization"), "Bearer pat-test-token");
}));

test("getAuthRequest surfaces 404 as AUTH_REQUEST_NOT_FOUND", withEnv(requiredEnv, async () => {
  const { fetchMock } = makeMockFetch({
    "GET https://zitadel.example.com/v2/oidc/auth_requests/V2_missing": {
      status: 404,
      body: { error: "not found" },
    },
  });

  await assert.rejects(() => getAuthRequest("V2_missing", { fetch: fetchMock }), {
    code: ZITADEL_ERROR_CODES.ZITADEL_AUTH_REQUEST_NOT_FOUND,
  });
}));

test("createPasswordSession builds v2/sessions body and returns sessionId", withEnv(requiredEnv, async () => {
  const { fetchMock, calls } = makeMockFetch({
    "POST https://zitadel.example.com/v2/sessions": (init) => {
      const body = JSON.parse(init.body);
      assert.equal(body.checks.user.loginName, "alice@example.com");
      assert.equal(body.checks.password.password, "hunter2");
      assert.equal(body.user.organizationId, "org-123");
      return { status: 200, body: { sessionId: "sess-1", sessionToken: "tok" } };
    },
  });

  const session = await createPasswordSession(
    { loginName: "alice@example.com", password: "hunter2" },
    { fetch: fetchMock }
  );
  assert.equal(session.sessionId, "sess-1");
  assert.equal(session.sessionToken, "tok");
  assert.equal(calls.length, 1);
}));

test("hydratePasswordSession loads user factors when create response omits them", withEnv(requiredEnv, async () => {
  const { fetchMock } = makeMockFetch({
    "GET https://zitadel.example.com/v2/sessions/sess-1": {
      status: 200,
      body: {
        session: {
          id: "sess-1",
          factors: {
            user: { id: "user-1", loginName: "alice" },
            password: { verifiedAt: "2026-06-30T00:00:00.000Z" },
          },
        },
      },
    },
  });

  const hydrated = await hydratePasswordSession(
    { sessionId: "sess-1", sessionToken: "tok-1", factors: {}, payload: {} },
    { fetch: fetchMock }
  );

  assert.equal(hydrated.factors.user.id, "user-1");
  assert.equal(hydrated.factors.user.loginName, "alice");
}));

test("createPasswordSession maps 401 to credential failure", withEnv(requiredEnv, async () => {
  const { fetchMock } = makeMockFetch({
    "POST https://zitadel.example.com/v2/sessions": {
      status: 401,
      body: { error: "invalid credentials" },
    },
  });

  await assert.rejects(
    () => createPasswordSession({ loginName: "alice", password: "x" }, { fetch: fetchMock }),
    { code: ZITADEL_ERROR_CODES.ZITADEL_CREDENTIALS_INVALID }
  );
}));

test("createPasswordSession maps 422 to password complexity failure", withEnv(requiredEnv, async () => {
  const { fetchMock } = makeMockFetch({
    "POST https://zitadel.example.com/v2/sessions": {
      status: 422,
      body: { error: "Errors.User.PasswordComplexityNotMet" },
    },
  });

  await assert.rejects(
    () => createPasswordSession({ loginName: "alice", password: "x" }, { fetch: fetchMock }),
    { code: ZITADEL_ERROR_CODES.ZITADEL_PASSWORD_COMPLEXITY }
  );
}));

test("createPasswordSession maps 403 to account locked when user is locked", withEnv(requiredEnv, async () => {
  const { fetchMock } = makeMockFetch({
    "POST https://zitadel.example.com/v2/sessions": () => ({
      status: 401,
      body: { error: "Errors.User.Locked" },
    }),
  });

  await assert.rejects(
    () => createPasswordSession({ loginName: "alice", password: "x" }, { fetch: fetchMock }),
    { code: ZITADEL_ERROR_CODES.ZITADEL_ACCOUNT_LOCKED }
  );
}));

test("createPasswordSession maps 429 to rate limited", withEnv(requiredEnv, async () => {
  const { fetchMock } = makeMockFetch({
    "POST https://zitadel.example.com/v2/sessions": {
      status: 429,
      body: { error: "too many attempts" },
    },
  });

  await assert.rejects(
    () => createPasswordSession({ loginName: "alice", password: "x" }, { fetch: fetchMock }),
    { code: ZITADEL_ERROR_CODES.ZITADEL_RATE_LIMITED }
  );
}));

test("finalizeAuthRequest returns callbackUrl", withEnv(requiredEnv, async () => {
  const { fetchMock } = makeMockFetch({
    "POST https://zitadel.example.com/v2/oidc/auth_requests/V2_real-id": (init) => {
      const body = JSON.parse(init.body);
      assert.equal(body.session.sessionId, "sess-1");
      assert.equal(body.session.sessionToken, "tok");
      return { status: 200, body: { callbackUrl: "https://app.example.com/cb?code=xyz" } };
    },
  });

  const result = await finalizeAuthRequest(
    { authRequestId: "V2_real-id", sessionId: "sess-1", sessionToken: "tok" },
    { fetch: fetchMock }
  );
  assert.equal(result.callbackUrl, "https://app.example.com/cb?code=xyz");
}));

test("finalizeAuthRequest surfaces 409 as AUTH_REQUEST_NOT_READY", withEnv(requiredEnv, async () => {
  const { fetchMock } = makeMockFetch({
    "POST https://zitadel.example.com/v2/oidc/auth_requests/V2_real-id": {
      status: 409,
      body: { error: "policies pending" },
    },
  });

  await assert.rejects(
    () => finalizeAuthRequest({ authRequestId: "V2_real-id", sessionId: "sess-1" }, { fetch: fetchMock }),
    { code: ZITADEL_ERROR_CODES.ZITADEL_AUTH_REQUEST_NOT_READY }
  );
}));

test("finalizeAuthRequest surfaces 403 as UNAUTHORIZED (session.link missing)", withEnv(requiredEnv, async () => {
  const { fetchMock } = makeMockFetch({
    "POST https://zitadel.example.com/v2/oidc/auth_requests/V2_real-id": {
      status: 403,
      body: { code: 7, message: "No matching permissions found" },
    },
  });

  await assert.rejects(
    () =>
      finalizeAuthRequest(
        { authRequestId: "V2_real-id", sessionId: "sess-1", sessionToken: "tok" },
        { fetch: fetchMock }
      ),
    { code: ZITADEL_ERROR_CODES.ZITADEL_UNAUTHORIZED }
  );
}));