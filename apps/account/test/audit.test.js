import assert from "node:assert/strict";
import test from "node:test";

import { AUDIT_EVENT_TYPES } from "@moauth/audit-store";

import {
  listAuditEventsForSub,
  recordAuditEvent,
  toActivityListResponse,
} from "../src/audit/service.js";
import { loginSuccessSummary } from "../src/audit/summaries.js";
import { resetAuditStoreForTests } from "../src/audit/store.js";

test("audit service records and lists events for sub", () => {
  resetAuditStoreForTests();
  recordAuditEvent({
    sub: "user-1",
    eventType: AUDIT_EVENT_TYPES.LOGIN_SUCCESS,
    summary: loginSuccessSummary(),
  });
  recordAuditEvent({
    sub: "user-2",
    eventType: AUDIT_EVENT_TYPES.PROFILE_UPDATED,
    summary: "更新个人资料",
  });

  const events = listAuditEventsForSub("user-1");
  assert.equal(events.length, 1);
  assert.equal(events[0].eventType, AUDIT_EVENT_TYPES.LOGIN_SUCCESS);

  const response = toActivityListResponse(events);
  assert.equal(response.status, "ACTIVITY_LIST");
  assert.equal(response.events[0].summary, loginSuccessSummary());
});

test("activity list returns at most 20 events", () => {
  resetAuditStoreForTests();
  for (let index = 0; index < 25; index += 1) {
    recordAuditEvent({
      sub: "user-1",
      eventType: AUDIT_EVENT_TYPES.LOGIN_SUCCESS,
      summary: `login ${index}`,
    });
  }

  assert.equal(listAuditEventsForSub("user-1").length, 20);
});