import assert from "node:assert/strict";
import test from "node:test";

import {
  approveRegistrationReview,
  rejectRegistrationReview,
} from "../src/admin/registration-review-api.js";
import { setUserStatus } from "../src/admin/users-api.js";
import {
  getRegistrationReviewStore,
  resetRegistrationReviewStoreForTests,
} from "../src/registration-review/store.js";
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
    resetRegistrationReviewStoreForTests();
    resetAuditStoreForTests();
    try {
      return await fn();
    } finally {
      process.env = { ...origEnv };
      resetRegistrationReviewStoreForTests();
      resetAuditStoreForTests();
    }
  };
}

test(
  "approveRegistrationReview retries approving state by calling Zitadel",
  withEnv(zitadelEnv, async () => {
    const store = getRegistrationReviewStore();
    const record = store.create({
      userId: "review-user",
      email: "review@example.com",
      loginName: "review@example.com",
      displayName: "Review User",
    });
    store.update(record.id, { reviewStatus: "approving" });

    const calls = [];
    const fetchMock = async (url, init) => {
      const key = `${init?.method || "GET"} ${String(url)}`;
      calls.push(key);
      if (key === "POST https://zitadel.example.com/v2/users/review-user/reactivate") {
        return ok({});
      }
      throw new Error(`Unexpected fetch ${key}`);
    };

    const approved = await approveRegistrationReview(record.id, ADMIN, { fetch: fetchMock });

    assert.equal(approved.reviewStatus, "approved");
    assert.deepEqual(calls, ["POST https://zitadel.example.com/v2/users/review-user/reactivate"]);
  })
);

test(
  "rejectRegistrationReview treats delete 404 as already deleted",
  withEnv(zitadelEnv, async () => {
    const store = getRegistrationReviewStore();
    const record = store.create({
      userId: "deleted-user",
      email: "deleted@example.com",
      loginName: "deleted@example.com",
      displayName: "Deleted User",
    });
    store.update(record.id, { reviewStatus: "rejecting" });

    const calls = [];
    const fetchMock = async (url, init) => {
      const key = `${init?.method || "GET"} ${String(url)}`;
      calls.push(key);
      if (key === "DELETE https://zitadel.example.com/v2/users/deleted-user") {
        return ok({ message: "not found" }, 404);
      }
      throw new Error(`Unexpected fetch ${key}`);
    };

    const rejected = await rejectRegistrationReview(record.id, ADMIN, "duplicate", { fetch: fetchMock });

    assert.equal(rejected.reviewStatus, "rejected");
    assert.deepEqual(calls, ["DELETE https://zitadel.example.com/v2/users/deleted-user"]);
  })
);

test(
  "setUserStatus blocks non-approved review records from generic reactivation",
  withEnv(zitadelEnv, async () => {
    getRegistrationReviewStore().create({
      userId: "pending-user",
      email: "pending@example.com",
      loginName: "pending@example.com",
      displayName: "Pending User",
    });
    const calls = [];
    const fetchMock = async (url, init) => {
      const key = `${init?.method || "GET"} ${String(url)}`;
      calls.push(key);
      if (key === "GET https://zitadel.example.com/management/v1/users/pending-user") {
        return ok({ id: "pending-user", state: "USER_STATE_INACTIVE", human: {} });
      }
      throw new Error(`Unexpected fetch ${key}`);
    };

    await assert.rejects(
      setUserStatus("pending-user", "active", ADMIN, { fetch: fetchMock }),
      (error) => error.code === "USER_STATUS_REVIEW_BLOCKED" && error.status === 403
    );
    assert.deepEqual(calls, ["GET https://zitadel.example.com/management/v1/users/pending-user"]);
  })
);

test(
  "setUserStatus allows approved review records to use generic reactivation",
  withEnv(zitadelEnv, async () => {
    const store = getRegistrationReviewStore();
    const record = store.create({
      userId: "approved-user",
      email: "approved@example.com",
      loginName: "approved@example.com",
      displayName: "Approved User",
    });
    store.update(record.id, { reviewStatus: "approved" });

    const calls = [];
    const fetchMock = async (url, init) => {
      const key = `${init?.method || "GET"} ${String(url)}`;
      calls.push(key);
      if (key === "GET https://zitadel.example.com/management/v1/users/approved-user") {
        return ok({ id: "approved-user", state: "USER_STATE_INACTIVE", human: {} });
      }
      if (key === "POST https://zitadel.example.com/v2/users/approved-user/reactivate") {
        return ok({});
      }
      throw new Error(`Unexpected fetch ${key}`);
    };

    const result = await setUserStatus("approved-user", "active", ADMIN, { fetch: fetchMock });

    assert.equal(result.status, "active");
    assert.deepEqual(calls, [
      "GET https://zitadel.example.com/management/v1/users/approved-user",
      "POST https://zitadel.example.com/v2/users/approved-user/reactivate",
    ]);
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
