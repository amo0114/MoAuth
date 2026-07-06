import assert from "node:assert/strict";
import test from "node:test";

import { resetAccountSessionStoreForTests } from "../src/session/account-session-store.js";
import { createAccountSession } from "../src/session/account-session.js";
import {
  changeAccountPassword,
  confirmEmailVerification,
  registerAccountUser,
  requestAccountPasswordReset,
  resetAccountPassword,
} from "../src/lifecycle/service.js";

const origEnv = { ...process.env };

function withEnv(partial, fn) {
  return async () => {
    process.env = { ...origEnv, ...partial, NODE_ENV: "test", MOAUTH_ACCOUNT_PUBLIC_URL: "http://127.0.0.1:3002" };
    resetAccountSessionStoreForTests();
    try {
      return await fn();
    } finally {
      process.env = { ...origEnv };
      resetAccountSessionStoreForTests();
    }
  };
}

const zitadelEnv = {
  ZITADEL_ISSUER: "https://zitadel.example.com",
  ZITADEL_SERVICE_USER_TOKEN: "pat-test",
  ZITADEL_ORG_ID: "org-1",
};

test(
  "registerAccountUser returns verify redirect and dev code",
  withEnv(zitadelEnv, async () => {
    const fetchMock = async (url, init) => {
      const key = `${init?.method || "GET"} ${String(url)}`;
      if (key === "POST https://zitadel.example.com/v2/users/human") {
        return ok({ userId: "user-new", emailCode: "MAIL99" });
      }
      throw new Error(`Unexpected fetch ${key}`);
    };

    const result = await registerAccountUser(
      { email: "new@example.com", password: "Password1!", displayName: "New User" },
      { fetch: fetchMock }
    );

    assert.equal(result.status, "REGISTERED");
    assert.match(result.redirectUrl, /\/verify-email\?/);
    assert.equal(result.dev.emailVerificationCode, "MAIL99");
  })
);

test(
  "requestAccountPasswordReset does not leak missing email",
  withEnv(zitadelEnv, async () => {
    const fetchMock = async (url, init) => {
      const key = `${init?.method || "GET"} ${String(url)}`;
      if (key === "POST https://zitadel.example.com/management/v1/users/_search") {
        return ok({ result: [] });
      }
      throw new Error(`Unexpected fetch ${key}`);
    };

    const result = await requestAccountPasswordReset({ email: "missing@example.com" }, { fetch: fetchMock });
    assert.equal(result.status, "PASSWORD_RESET_REQUESTED");
    assert.equal(result.dev, undefined);
  })
);

test(
  "resetAccountPassword completes when user and code are valid",
  withEnv(zitadelEnv, async () => {
    const fetchMock = async (url, init) => {
      const key = `${init?.method || "GET"} ${String(url)}`;
      if (key === "POST https://zitadel.example.com/management/v1/users/_search") {
        return ok({
          result: [
            {
              id: "user-1",
              preferredLoginName: "alice",
              human: { email: { email: "alice@example.com", isEmailVerified: true } },
            },
          ],
        });
      }
      if (key === "POST https://zitadel.example.com/v2/users/user-1/password") {
        return ok({});
      }
      throw new Error(`Unexpected fetch ${key}`);
    };

    const result = await resetAccountPassword(
      { email: "alice@example.com", verificationCode: "CODE1", newPassword: "NewPass2026!" },
      { fetch: fetchMock }
    );
    assert.equal(result.status, "PASSWORD_RESET_COMPLETED");
  })
);

test(
  "confirmEmailVerification and changeAccountPassword call Zitadel",
  withEnv(zitadelEnv, async () => {
    const fetchMock = async (url, init) => {
      const key = `${init?.method || "GET"} ${String(url)}`;
      if (key === "POST https://zitadel.example.com/v2/users/user-1/email/verify") return ok({});
      if (key === "POST https://zitadel.example.com/v2/users/user-1/password") return ok({});
      throw new Error(`Unexpected fetch ${key}`);
    };

    const verified = await confirmEmailVerification(
      { userId: "user-1", verificationCode: "MAIL1" },
      { fetch: fetchMock }
    );
    assert.equal(verified.status, "EMAIL_VERIFIED");

    const session = createAccountSession({
      session: { sessionId: "sess-1", sessionToken: "tok-1" },
      sub: "user-1",
      loginName: "alice",
      now: new Date("2026-06-30T12:00:00.000Z"),
    });
    const changed = await changeAccountPassword(
      session,
      { currentPassword: "old", newPassword: "newPass2026!" },
      { fetch: fetchMock }
    );
    assert.equal(changed.status, "PASSWORD_CHANGED");
  })
);

function ok(body, status = 200) {
  return {
    ok: status >= 200 && status < 300,
    status,
    text: async () => JSON.stringify(body),
    headers: new Headers(),
  };
}