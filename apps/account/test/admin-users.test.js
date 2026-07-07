import assert from "node:assert/strict";
import test from "node:test";

import { AUDIT_EVENT_TYPES } from "@moauth/audit-store";

import {
  mapAdminUserError,
  requestUserPasswordReset,
} from "../src/admin/users-api.js";
import { listAuditEventsForSub } from "../src/audit/service.js";
import { resetAuditStoreForTests } from "../src/audit/store.js";

const origEnv = { ...process.env };
const ADMIN = { sub: "admin-subject", isAdmin: true };

const zitadelEnv = {
  ZITADEL_ISSUER: "https://zitadel.example.com",
  ZITADEL_SERVICE_USER_TOKEN: "pat-test",
  ZITADEL_ORG_ID: "org-1",
};

function withEnv(partial, fn) {
  return async () => {
    process.env = { ...origEnv, ...partial, NODE_ENV: "test" };
    resetAuditStoreForTests();
    try {
      return await fn();
    } finally {
      process.env = { ...origEnv };
      resetAuditStoreForTests();
    }
  };
}

test(
  "requestUserPasswordReset sends Zitadel reset link and records audit event",
  withEnv(zitadelEnv, async () => {
    const calls = [];
    const fetchMock = async (url, init) => {
      const key = `${init?.method || "GET"} ${String(url)}`;
      calls.push({ key, body: JSON.parse(String(init?.body || "{}")) });
      if (key === "POST https://zitadel.example.com/v2/users/user-1/password_reset") {
        return ok({});
      }
      throw new Error(`Unexpected fetch ${key}`);
    };

    const result = await requestUserPasswordReset(" user-1 ", ADMIN, { fetch: fetchMock });

    assert.deepEqual(result, { status: "password_reset_requested", userId: "user-1" });
    assert.deepEqual(calls, [
      {
        key: "POST https://zitadel.example.com/v2/users/user-1/password_reset",
        body: { sendLink: {} },
      },
    ]);

    const events = listAuditEventsForSub(ADMIN.sub);
    assert.equal(events.length, 1);
    assert.equal(events[0].eventType, AUDIT_EVENT_TYPES.ADMIN_USER_PASSWORD_RESET_REQUESTED);
    assert.equal(events[0].metadata.userId, "user-1");
    assert.equal(events[0].metadata.delivery, "email");
  })
);

test(
  "requestUserPasswordReset rejects self reset through admin operation",
  withEnv(zitadelEnv, async () => {
    await assert.rejects(
      requestUserPasswordReset(ADMIN.sub, ADMIN),
      (error) => error.code === "USER_PASSWORD_RESET_SELF" && error.status === 400
    );

    assert.equal(listAuditEventsForSub(ADMIN.sub).length, 0);
  })
);

test(
  "requestUserPasswordReset maps Zitadel rate limit to 429",
  withEnv(zitadelEnv, async () => {
    const fetchMock = async (url, init) => {
      const key = `${init?.method || "GET"} ${String(url)}`;
      if (key === "POST https://zitadel.example.com/v2/users/user-1/password_reset") {
        return ok({ message: "too many requests" }, 429);
      }
      throw new Error(`Unexpected fetch ${key}`);
    };

    await assert.rejects(
      requestUserPasswordReset("user-1", ADMIN, { fetch: fetchMock }),
      (error) => error.code === "USER_PASSWORD_RESET_RATE_LIMITED" && error.status === 429
    );

    assert.deepEqual(mapAdminUserError({ code: "USER_PASSWORD_RESET_RATE_LIMITED", message: "rate", status: 429 }), {
      status: 429,
      body: { error: "rate", code: "USER_PASSWORD_RESET_RATE_LIMITED" },
    });
  })
);

test(
  "requestUserPasswordReset maps missing Zitadel user to 404",
  withEnv(zitadelEnv, async () => {
    const fetchMock = async (url, init) => {
      const key = `${init?.method || "GET"} ${String(url)}`;
      if (key === "POST https://zitadel.example.com/v2/users/missing-user/password_reset") {
        return ok({ message: "not found" }, 404);
      }
      throw new Error(`Unexpected fetch ${key}`);
    };

    await assert.rejects(
      requestUserPasswordReset("missing-user", ADMIN, { fetch: fetchMock }),
      (error) => error.code === "USER_PASSWORD_RESET_NOT_FOUND" && error.status === 404
    );
  })
);

test(
  "requestUserPasswordReset maps generic Zitadel failure to 502",
  withEnv(zitadelEnv, async () => {
    const fetchMock = async (url, init) => {
      const key = `${init?.method || "GET"} ${String(url)}`;
      if (key === "POST https://zitadel.example.com/v2/users/user-1/password_reset") {
        return ok({ message: "upstream failed" }, 500);
      }
      throw new Error(`Unexpected fetch ${key}`);
    };

    await assert.rejects(
      requestUserPasswordReset("user-1", ADMIN, { fetch: fetchMock }),
      (error) => error.code === "USER_PASSWORD_RESET_UNAVAILABLE" && error.status === 502
    );
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
