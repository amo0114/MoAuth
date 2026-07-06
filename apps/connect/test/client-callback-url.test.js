import assert from "node:assert/strict";
import test from "node:test";

import { normalizeClientCallbackUrl } from "../src/oidc/client-callback-url.js";

test("normalizeClientCallbackUrl adds missing state from auth request info", () => {
  const callbackUrl = normalizeClientCallbackUrl(
    "http://127.0.0.1:3001/api/auth/moauth/callback?code=abc",
    { state: "state-from-auth-request" }
  );

  const url = new URL(callbackUrl);
  assert.equal(url.searchParams.get("code"), "abc");
  assert.equal(url.searchParams.get("state"), "state-from-auth-request");
});

test("normalizeClientCallbackUrl preserves existing state", () => {
  const callbackUrl = normalizeClientCallbackUrl(
    "http://127.0.0.1:3001/api/auth/moauth/callback?code=abc&state=existing",
    { state: "state-from-auth-request" }
  );

  assert.equal(new URL(callbackUrl).searchParams.get("state"), "existing");
});