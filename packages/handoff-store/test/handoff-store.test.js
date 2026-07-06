import assert from "node:assert/strict";
import test from "node:test";

import { HANDOFF_ERROR_CODES, createMemoryHandoffStore } from "../src/index.js";

const basePayload = {
  authRequestId: "V2_test",
  clientId: "subboost-dev",
  redirectUri: "http://127.0.0.1:3001/api/auth/moauth/callback",
  scopes: ["openid", "profile", "email"],
  sub: "user-1",
  loginName: "alice",
  email: "alice@example.com",
  emailVerified: true,
  sessionId: "sess-1",
  sessionToken: "tok-1",
};
const origEnv = { ...process.env };

test.afterEach(() => {
  process.env = { ...origEnv };
});

test("issueHandoff returns opaque code and stores only hash", () => {
  const store = createMemoryHandoffStore();
  const issued = store.issueHandoff(basePayload);

  assert.match(issued.code, /^[A-Za-z0-9_-]+$/);
  assert.ok(issued.code.length >= 32);
  assert.ok(issued.expiresAt);
});

test("consumeHandoff returns payload and marks record consumed", () => {
  const store = createMemoryHandoffStore();
  const { code } = store.issueHandoff(basePayload);

  const consumed = store.consumeHandoff({ code, authRequestId: "V2_test" });
  assert.equal(consumed.status, "HANDOFF_CONSUMED");
  assert.equal(consumed.payload.sessionId, "sess-1");
  assert.equal(consumed.payload.clientId, "subboost-dev");

  assert.throws(
    () => store.consumeHandoff({ code, authRequestId: "V2_test" }),
    { code: HANDOFF_ERROR_CODES.HANDOFF_ALREADY_CONSUMED }
  );
});

test("consumeHandoff rejects replay with HANDOFF_ALREADY_CONSUMED", () => {
  let now = new Date("2026-06-30T12:00:00.000Z");
  const store = createMemoryHandoffStore({ now: () => now });
  const { code } = store.issueHandoff(basePayload);

  store.consumeHandoff({ code, authRequestId: "V2_test" });

  assert.throws(
    () => store.consumeHandoff({ code, authRequestId: "V2_test" }),
    { code: HANDOFF_ERROR_CODES.HANDOFF_ALREADY_CONSUMED }
  );
});

test("consumeHandoff rejects expired code", () => {
  let now = new Date("2026-06-30T12:00:00.000Z");
  const store = createMemoryHandoffStore({ now: () => now, ttlSeconds: 60 });
  const { code } = store.issueHandoff(basePayload);

  now = new Date("2026-06-30T12:01:01.000Z");
  assert.throws(
    () => store.consumeHandoff({ code, authRequestId: "V2_test" }),
    { code: HANDOFF_ERROR_CODES.HANDOFF_EXPIRED }
  );
});

test("consumeHandoff rejects authRequest binding mismatch", () => {
  const store = createMemoryHandoffStore();
  const { code } = store.issueHandoff(basePayload);

  assert.throws(
    () => store.consumeHandoff({ code, authRequestId: "V2_other" }),
    { code: HANDOFF_ERROR_CODES.HANDOFF_BINDING_MISMATCH }
  );
});

test("issueHandoff encrypts sessionToken at rest but returns plaintext on consume", () => {
  const store = createMemoryHandoffStore({ storeSecret: "test-secret" });
  const { code } = store.issueHandoff(basePayload);
  const consumed = store.consumeHandoff({ code, authRequestId: "V2_test" });
  assert.equal(consumed.payload.sessionToken, "tok-1");
});

test("production memory store requires a configured store secret", () => {
  process.env = { ...origEnv, NODE_ENV: "production" };
  delete process.env.MOAUTH_HANDOFF_STORE_SECRET;
  delete process.env.MOAUTH_HANDOFF_INTERNAL_TOKEN;

  assert.throws(() => createMemoryHandoffStore(), {
    code: HANDOFF_ERROR_CODES.HANDOFF_INVALID_PAYLOAD,
  });
});

test("production memory store accepts handoff internal token as store secret", () => {
  process.env = {
    ...origEnv,
    NODE_ENV: "production",
    MOAUTH_HANDOFF_INTERNAL_TOKEN: "handoff-secret",
  };
  delete process.env.MOAUTH_HANDOFF_STORE_SECRET;

  const store = createMemoryHandoffStore();
  const { code } = store.issueHandoff(basePayload);
  const consumed = store.consumeHandoff({ code, authRequestId: "V2_test" });
  assert.equal(consumed.payload.sessionToken, "tok-1");
});

test("issueHandoff rejects incomplete payload", () => {
  const store = createMemoryHandoffStore();
  assert.throws(() => store.issueHandoff({ ...basePayload, sessionToken: "" }), {
    code: HANDOFF_ERROR_CODES.HANDOFF_INVALID_PAYLOAD,
  });
});
