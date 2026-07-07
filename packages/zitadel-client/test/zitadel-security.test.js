import assert from "node:assert/strict";
import test from "node:test";

import {
  listHumanAuthFactors,
  listHumanPasswordless,
} from "../src/security.js";

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
  return async (url, init) => {
    const key = `${init?.method || "GET"} ${String(url)}`;
    const responder = responses[key];
    if (!responder) throw new Error(`Unexpected fetch ${key}`);
    const result = typeof responder === "function" ? responder(init) : responder;
    const status = result.status ?? 200;
    return {
      ok: status >= 200 && status < 300,
      status,
      text: async () => JSON.stringify(result.body ?? {}),
      headers: new Headers(),
    };
  };
}

const requiredEnv = {
  ZITADEL_API_BASE: "https://zitadel.example.com",
  ZITADEL_ISSUER: "https://zitadel.example.com",
  ZITADEL_SERVICE_USER_TOKEN: "pat-test-token",
  ZITADEL_ORG_ID: "org-123",
};

test(
  "listHumanAuthFactors calls management API and maps public factor state",
  withEnv(requiredEnv, async () => {
    const fetchMock = makeMockFetch({
      "POST https://zitadel.example.com/management/v1/users/user-1/auth_factors/_search": (init) => {
        assert.equal(init.headers.get("x-zitadel-orgid"), "org-123");
        assert.equal(init.headers.get("Authorization"), "Bearer pat-test-token");
        assert.equal(init.body, "{}");
        return {
          body: {
            result: [
              { otp: {}, state: "FACTOR_STATE_READY" },
              { u2f: { id: "u2f-1", state: "FACTOR_STATE_READY" } },
            ],
          },
        };
      },
    });

    const factors = await listHumanAuthFactors("user-1", { fetch: fetchMock });
    assert.deepEqual(
      factors.map((factor) => factor.type),
      ["totp", "u2f"]
    );
    assert.equal(factors[1].id, "u2f-1");
  })
);

test(
  "listHumanPasswordless calls management API and maps passkey tokens safely",
  withEnv(requiredEnv, async () => {
    const fetchMock = makeMockFetch({
      "POST https://zitadel.example.com/management/v1/users/user-1/passwordless/_search": {
        body: {
          result: [
            {
              id: "passkey-1",
              name: "MacBook Touch ID",
              state: "WEBAUTHN_TOKEN_STATE_READY",
              details: {
                creationDate: "2026-07-01T10:00:00Z",
                changeDate: "2026-07-02T10:00:00Z",
              },
            },
          ],
        },
      },
    });

    const passkeys = await listHumanPasswordless("user-1", { fetch: fetchMock });
    assert.deepEqual(passkeys, [
      {
        id: "passkey-1",
        name: "MacBook Touch ID",
        state: "WEBAUTHN_TOKEN_STATE_READY",
        createdAt: "2026-07-01T10:00:00Z",
        updatedAt: "2026-07-02T10:00:00Z",
      },
    ]);
  })
);
