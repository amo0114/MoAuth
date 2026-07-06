import assert from "node:assert/strict";
import test from "node:test";

import { getSessionSecret } from "../src/oidc/connect-session.js";
import { getTransactionSecret } from "../src/oidc/transaction.js";

const origEnv = { ...process.env };

test.afterEach(() => {
  process.env = { ...origEnv };
});

test("Connect session secret is required in production", () => {
  process.env = { ...origEnv, NODE_ENV: "production" };
  delete process.env.MOAUTH_CONNECT_SESSION_SECRET;

  assert.throws(() => getSessionSecret(), {
    message: "MOAUTH_CONNECT_SESSION_SECRET is required in production.",
  });
});

test("Connect transaction secret is required in production", () => {
  process.env = { ...origEnv, NODE_ENV: "production" };
  delete process.env.MOAUTH_CONNECT_TRANSACTION_SECRET;

  assert.throws(() => getTransactionSecret(), {
    message: "MOAUTH_CONNECT_TRANSACTION_SECRET is required in production.",
  });
});

test("Connect runtime secrets still use local fallbacks outside production", () => {
  process.env = { ...origEnv, NODE_ENV: "test" };
  delete process.env.MOAUTH_CONNECT_SESSION_SECRET;
  delete process.env.MOAUTH_CONNECT_TRANSACTION_SECRET;

  assert.equal(getSessionSecret(), "moauth-connect-dev-session-secret-change-me");
  assert.equal(getTransactionSecret(), "moauth-connect-dev-transaction-secret-change-me");
});
