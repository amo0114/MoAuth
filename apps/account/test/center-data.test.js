import assert from "node:assert/strict";
import test from "node:test";

import {
  getActivityList,
  getApplicationList,
  getSecuritySummary,
  getSessionList,
} from "../src/mock/center-data.js";
import { createAccountSession } from "../src/session/account-session.js";

const session = createAccountSession({
  session: { sessionId: "sess-1", sessionToken: "tok-1" },
  sub: "user-1",
  loginName: "alice",
  now: new Date("2026-06-30T12:00:00.000Z"),
});

test("mock center APIs expose stable response shapes", () => {
  const security = getSecuritySummary();
  assert.equal(security.status, "SECURITY_SUMMARY");
  assert.equal(security.mfa.enabled, false);

  const sessions = getSessionList(session);
  assert.equal(sessions.status, "SESSION_LIST");
  assert.equal(sessions.sessions[0].current, true);

  const apps = getApplicationList();
  assert.equal(apps.status, "APPLICATION_LIST");
  assert.equal(apps.applications[0].clientId, "subboost-dev");

  const activity = getActivityList(session);
  assert.equal(activity.status, "ACTIVITY_LIST");
  assert.equal(activity.events[0].eventType, "login_success");
});