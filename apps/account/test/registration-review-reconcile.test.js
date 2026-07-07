import assert from "node:assert/strict";
import test from "node:test";

import { AUDIT_EVENT_TYPES } from "@moauth/audit-store";

import { reconcileRegistrationReviews } from "../src/registration-review/reconcile.js";
import {
  getRegistrationReviewStore,
  resetRegistrationReviewStoreForTests,
} from "../src/registration-review/store.js";
import { listAuditEventsForSub } from "../src/audit/service.js";
import { resetAuditStoreForTests } from "../src/audit/store.js";

const origEnv = { ...process.env };
const SYSTEM_SUB = "system:registration-review-reconcile";

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
  "reconcileRegistrationReviews restores approving records to approved",
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
      if (key === "PUT https://zitadel.example.com/v2/users/review-user/reactivate") {
        return response({});
      }
      throw new Error(`Unexpected fetch ${key}`);
    };

    const result = await reconcileRegistrationReviews({ fetch: fetchMock });

    assert.equal(store.getById(record.id).reviewStatus, "approved");
    assert.deepEqual(result.reconciled, [
      { id: record.id, userId: "review-user", from: "approving", to: "approved" },
    ]);
    assert.deepEqual(result.failed, []);
    assert.deepEqual(calls, ["PUT https://zitadel.example.com/v2/users/review-user/reactivate"]);

    const events = listAuditEventsForSub(SYSTEM_SUB);
    assert.equal(events.length, 1);
    assert.equal(events[0].eventType, AUDIT_EVENT_TYPES.REGISTRATION_REVIEW_RECONCILED);
    assert.equal(events[0].metadata.reviewId, record.id);
    assert.equal(events[0].metadata.fromStatus, "approving");
    assert.equal(events[0].metadata.toStatus, "approved");
  })
);

test(
  "reconcileRegistrationReviews treats rejecting delete 404 as rejected",
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
        return response({ message: "not found" }, 404);
      }
      throw new Error(`Unexpected fetch ${key}`);
    };

    const result = await reconcileRegistrationReviews({ fetch: fetchMock });

    assert.equal(store.getById(record.id).reviewStatus, "rejected");
    assert.deepEqual(result.reconciled, [
      { id: record.id, userId: "deleted-user", from: "rejecting", to: "rejected" },
    ]);
    assert.deepEqual(result.failed, []);
    assert.deepEqual(calls, ["DELETE https://zitadel.example.com/v2/users/deleted-user"]);

    const events = listAuditEventsForSub(SYSTEM_SUB);
    assert.equal(events.length, 1);
    assert.equal(events[0].eventType, AUDIT_EVENT_TYPES.REGISTRATION_REVIEW_RECONCILED);
    assert.equal(events[0].metadata.reviewId, record.id);
    assert.equal(events[0].metadata.fromStatus, "rejecting");
    assert.equal(events[0].metadata.toStatus, "rejected");
  })
);

function response(body, status = 200) {
  return {
    ok: status >= 200 && status < 300,
    status,
    text: async () => JSON.stringify(body),
    headers: new Headers(),
  };
}
