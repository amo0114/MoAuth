import assert from "node:assert/strict";
import test from "node:test";

import { getConnectPasswordLoginGate } from "../src/oidc/password-login-policy.js";

const origEnv = { ...process.env };

test("getConnectPasswordLoginGate blocks password login when fallback is disabled", () => {
  process.env = { ...origEnv, CONNECT_PASSWORD_LOGIN_FALLBACK: "false" };
  const gate = getConnectPasswordLoginGate();
  assert.equal(gate.allowed, false);
  assert.equal(gate.code, "CONNECT_PASSWORD_LOGIN_DISABLED");
  assert.equal(gate.status, 403);
  process.env = { ...origEnv };
});

test("getConnectPasswordLoginGate allows password login only when fallback is enabled", () => {
  process.env = { ...origEnv, CONNECT_PASSWORD_LOGIN_FALLBACK: "true" };
  const gate = getConnectPasswordLoginGate();
  assert.deepEqual(gate, { allowed: true });
  process.env = { ...origEnv };
});