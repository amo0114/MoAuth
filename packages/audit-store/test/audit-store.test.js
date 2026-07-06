import assert from "node:assert/strict";
import test from "node:test";

import { AUDIT_EVENT_TYPES, AuditError, createMemoryAuditStore } from "../src/index.js";

const now = new Date("2026-06-30T12:00:00.000Z");

test("appendEvent stores events and listBySub returns newest first", () => {
  const store = createMemoryAuditStore({
    now: () => now,
    defaultLimit: 20,
  });

  store.appendEvent({
    sub: "user-1",
    eventType: AUDIT_EVENT_TYPES.LOGIN_SUCCESS,
    summary: "账号中心登录成功",
  });
  store.appendEvent({
    sub: "user-1",
    eventType: AUDIT_EVENT_TYPES.PROFILE_UPDATED,
    summary: "更新个人资料",
    metadata: { fields: ["displayName"] },
  });

  const events = store.listBySub("user-1");
  assert.equal(events.length, 2);
  assert.equal(events[0].eventType, AUDIT_EVENT_TYPES.PROFILE_UPDATED);
  assert.deepEqual(events[1].metadata, null);
});

test("listBySub respects limit", () => {
  const store = createMemoryAuditStore({ now: () => now });
  for (let index = 0; index < 25; index += 1) {
    store.appendEvent({
      sub: "user-1",
      eventType: AUDIT_EVENT_TYPES.LOGIN_SUCCESS,
      summary: `login ${index}`,
    });
  }

  assert.equal(store.listBySub("user-1", { limit: 20 }).length, 20);
});

test("appendEvent rejects unknown event types", () => {
  const store = createMemoryAuditStore({ now: () => now });
  assert.throws(
    () =>
      store.appendEvent({
        sub: "user-1",
        eventType: "unknown_event",
        summary: "bad",
      }),
    (error) => {
      assert.ok(error instanceof AuditError);
      return true;
    }
  );
});