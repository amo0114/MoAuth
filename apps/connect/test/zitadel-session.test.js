import assert from "node:assert/strict";
import test from "node:test";

import {
  CONNECT_SESSION_COOKIE,
  createConnectSession,
  readConnectSessionFromCookie,
  signConnectSession,
} from "../src/oidc/connect-session.js";
import { resetConnectSessionStoreForTests } from "../src/oidc/connect-session-store.js";

test("Connect session cookie round-trips and expires", () => {
  resetConnectSessionStoreForTests();
  const now = new Date("2026-06-29T12:00:00.000Z");
  const session = createConnectSession(
    {
      authRequestId: "V2_real-id",
      session: { sessionId: "sess-1", sessionToken: "tok" },
      loginName: "alice",
      now,
    }
  );
  const cookieValue = signConnectSession(session, "test-secret");
  const verified = readConnectSessionFromCookie(cookieValue, now, "test-secret");
  assert.equal(verified.sessionId, "sess-1");
  assert.equal(verified.authRequestId, "V2_real-id");

  assert.throws(() => readConnectSessionFromCookie(`${cookieValue}x`, new Date(), "test-secret"), {
    code: "CONNECT_SESSION_INVALID",
  });
  assert.throws(
    () => readConnectSessionFromCookie(cookieValue, new Date("2026-06-29T12:35:00.000Z"), "test-secret"),
    { code: "CONNECT_SESSION_EXPIRED" }
  );
});

test("Connect re-exports zitadel-client without duplicating implementation", async () => {
  const sessionModule = await import("../src/oidc/session.js");
  const zitadelClient = await import("@moauth/zitadel-client");
  assert.equal(sessionModule.createPasswordSession, zitadelClient.createPasswordSession);
  assert.equal(sessionModule.finalizeAuthRequest, zitadelClient.finalizeAuthRequest);
  assert.equal(sessionModule.getAuthRequest, zitadelClient.getAuthRequest);
});