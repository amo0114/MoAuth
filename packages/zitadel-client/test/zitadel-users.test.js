import assert from "node:assert/strict";
import test from "node:test";

import {
  registerHumanUser,
  requestPasswordReset,
  searchHumanUserByEmail,
  setPasswordWithVerificationCode,
  verifyUserEmail,
} from "../src/users.js";

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
  "searchHumanUserByEmail returns mapped user",
  withEnv(requiredEnv, async () => {
    const fetchMock = makeMockFetch({
      "POST https://zitadel.example.com/management/v1/users/_search": {
        body: {
          result: [
            {
              id: "user-1",
              preferredLoginName: "alice",
              human: {
                profile: { displayName: "Alice" },
                email: { email: "alice@example.com", isEmailVerified: true },
              },
            },
          ],
        },
      },
    });

    const user = await searchHumanUserByEmail("alice@example.com", { fetch: fetchMock });
    assert.equal(user.id, "user-1");
    assert.equal(user.emailVerified, true);
  })
);

test(
  "registerHumanUser creates user and returns email code",
  withEnv(requiredEnv, async () => {
    const fetchMock = makeMockFetch({
      "POST https://zitadel.example.com/v2/users/human": {
        body: { userId: "user-2", emailCode: "ABC123" },
      },
    });

    const result = await registerHumanUser(
      {
        email: "bob@example.com",
        password: "Password1!",
        displayName: "Bob",
      },
      { fetch: fetchMock, returnVerificationCode: true }
    );
    assert.equal(result.userId, "user-2");
    assert.equal(result.emailCode, "ABC123");
  })
);

test(
  "verifyUserEmail and password reset helpers call v2 endpoints",
  withEnv(requiredEnv, async () => {
    const fetchMock = makeMockFetch({
      "POST https://zitadel.example.com/v2/users/user-1/email/verify": { body: {} },
      "POST https://zitadel.example.com/v2/users/user-1/password_reset": {
        body: { verificationCode: "RESET1" },
      },
      "POST https://zitadel.example.com/v2/users/user-1/password": { body: {} },
    });

    await verifyUserEmail("user-1", "MAIL1", { fetch: fetchMock });
    const reset = await requestPasswordReset("user-1", { fetch: fetchMock, returnVerificationCode: true });
    assert.equal(reset.verificationCode, "RESET1");
    await setPasswordWithVerificationCode("user-1", "RESET1", "NewPass2026!", { fetch: fetchMock });
  })
);