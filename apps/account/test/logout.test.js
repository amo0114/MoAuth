import assert from "node:assert/strict";
import test from "node:test";

import {
  ACCOUNT_SESSION_COOKIE,
  CONNECT_SESSION_COOKIE,
  clearAccountSessionCookieOptions,
  clearConnectSessionCookieOptions,
} from "../src/session/account-session.js";

test("Account logout clears both MoAuth session cookie names on loopback", () => {
  const logoutUrl = "http://127.0.0.1:3002/api/logout";
  const accountClear = clearAccountSessionCookieOptions(logoutUrl);
  const connectClear = clearConnectSessionCookieOptions(logoutUrl);

  assert.equal(ACCOUNT_SESSION_COOKIE, "moauth_account_session");
  assert.equal(CONNECT_SESSION_COOKIE, "moauth_connect_session");
  assert.equal(accountClear.maxAge, 0);
  assert.equal(connectClear.maxAge, 0);
  assert.equal(accountClear.path, "/");
  assert.equal(connectClear.path, "/");
});