import assert from "node:assert/strict";
import test from "node:test";

import { getHumanUser, updateHumanProfile } from "../src/profile.js";

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
  "getHumanUser maps profile and email fields",
  withEnv(requiredEnv, async () => {
    const fetchMock = makeMockFetch({
      "GET https://zitadel.example.com/management/v1/users/user-1": {
        body: {
          user: {
            id: "user-1",
            preferredLoginName: "alice",
            state: "USER_STATE_INACTIVE",
            human: {
              profile: {
                firstName: "Alice",
                lastName: "Wonderland",
                displayName: "Alice Wonderland",
              },
              email: { email: "alice@example.com", isEmailVerified: true },
            },
          },
        },
      },
    });

    const user = await getHumanUser("user-1", { fetch: fetchMock });
    assert.equal(user.loginName, "alice");
    assert.equal(user.state, "USER_STATE_INACTIVE");
    assert.equal(user.displayName, "Alice Wonderland");
    assert.equal(user.emailVerified, true);
  })
);

test(
  "updateHumanProfile sends PUT and reloads user",
  withEnv(requiredEnv, async () => {
    const fetchMock = makeMockFetch({
      "PUT https://zitadel.example.com/management/v1/users/user-1/profile": {
        body: {},
      },
      "GET https://zitadel.example.com/management/v1/users/user-1": {
        body: {
          user: {
            id: "user-1",
            preferredLoginName: "alice",
            human: {
              profile: {
                firstName: "Alice",
                lastName: "W.",
                displayName: "Alice W.",
              },
              email: { email: "alice@example.com", isEmailVerified: true },
            },
          },
        },
      },
    });

    const user = await updateHumanProfile(
      "user-1",
      { displayName: "Alice W.", firstName: "Alice", lastName: "W." },
      { fetch: fetchMock }
    );
    assert.equal(user.displayName, "Alice W.");
    assert.equal(user.lastName, "W.");
  })
);
