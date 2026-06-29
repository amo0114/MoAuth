import assert from "node:assert/strict";
import test from "node:test";

import { ZITADEL_ERROR_CODES } from "../src/config/zitadel.js";
import {
  CONNECT_SESSION_COOKIE,
  createConnectSession,
  readConnectSessionFromCookie,
  signConnectSession,
} from "../src/oidc/connect-session.js";

const SECRET = "test-secret";
const NOW = new Date("2026-06-29T12:00:00.000Z");

function makeSession(overrides = {}) {
  return createConnectSession({
    authRequestId: "V2_real-id",
    session: {
      sessionId: "sess-1",
      sessionToken: "tok",
      loginName: "alice",
      ...overrides,
    },
    now: NOW,
  });
}

test("connect session preserves loginName for account continuation", () => {
  const session = makeSession();
  assert.equal(session.loginName, "alice");
  assert.equal(session.sessionId, "sess-1");
  assert.equal(session.sessionToken, "tok");
  assert.equal(session.authRequestId, "V2_real-id");
});

test("signed session round-trips and exposes loginName for continue endpoint", () => {
  const session = makeSession();
  const cookieValue = signConnectSession(session, SECRET);
  const verified = readConnectSessionFromCookie(cookieValue, NOW, SECRET);
  assert.equal(verified.loginName, "alice");
  assert.equal(verified.sessionId, "sess-1");
  assert.equal(verified.sessionToken, "tok");
});

test("expired session is rejected so continue endpoint forces re-login", () => {
  const session = makeSession();
  const cookieValue = signConnectSession(session, SECRET);
  assert.throws(
    () => readConnectSessionFromCookie(cookieValue, new Date("2026-06-29T12:35:00.000Z"), SECRET),
    { code: "CONNECT_SESSION_EXPIRED" }
  );
});

test("tampered session cookie is rejected before any finalize call", () => {
  const session = makeSession();
  const cookieValue = signConnectSession(session, SECRET);
  assert.throws(
    () => readConnectSessionFromCookie(`${cookieValue}x`, NOW, SECRET),
    { code: "CONNECT_SESSION_INVALID" }
  );
});

test("CONNECT_SESSION_COOKIE name is stable for proxy and route alignment", () => {
  assert.equal(CONNECT_SESSION_COOKIE, "moauth_connect_session");
});
