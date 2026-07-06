import assert from "node:assert/strict";
import test from "node:test";

import { evaluateAccountReadiness } from "../src/health/ready-check.js";

const origEnv = { ...process.env };

function withEnv(partial, fn) {
  process.env = { ...origEnv, ...partial };
  return fn();
}

test("evaluateAccountReadiness reports not ready when Zitadel is missing", () =>
  withEnv(
    {
      ZITADEL_ISSUER: "",
      ZITADEL_SERVICE_USER_TOKEN: "",
      MOAUTH_HANDOFF_INTERNAL_TOKEN: "handoff-token",
    },
    async () => {
      const result = await evaluateAccountReadiness();
      assert.equal(result.ok, false);
      assert.equal(result.checks.zitadel, false);
      assert.equal(result.checks.handoff, true);
    }
  ));

test("evaluateAccountReadiness reports not ready when handoff token is missing", () =>
  withEnv(
    {
      ZITADEL_ISSUER: "https://zitadel.example.com",
      ZITADEL_SERVICE_USER_TOKEN: "pat-test",
      MOAUTH_HANDOFF_INTERNAL_TOKEN: "",
    },
    async () => {
      const result = await evaluateAccountReadiness();
      assert.equal(result.ok, false);
      assert.equal(result.checks.zitadel, true);
      assert.equal(result.checks.handoff, false);
    }
  ));

test("evaluateAccountReadiness reports ready when required dependencies are configured", () =>
  withEnv(
    {
      ZITADEL_ISSUER: "https://zitadel.example.com",
      ZITADEL_SERVICE_USER_TOKEN: "pat-test",
      MOAUTH_HANDOFF_INTERNAL_TOKEN: "handoff-token",
    },
    async () => {
      const result = await evaluateAccountReadiness();
      assert.equal(result.ok, true);
      assert.equal(result.service, "account");
    }
  ));

test.after(() => {
  process.env = origEnv;
});