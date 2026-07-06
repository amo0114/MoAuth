import assert from "node:assert/strict";
import test from "node:test";

import { AUDIT_EVENT_TYPES } from "@moauth/audit-store";

import { recordAuditEventFromAccount } from "../src/audit/account-client.js";

const origEnv = { ...process.env };

function withEnv(partial, fn) {
  return async () => {
    process.env = { ...origEnv, ...partial };
    try {
      return await fn();
    } finally {
      process.env = { ...origEnv };
    }
  };
}

test(
  "recordAuditEventFromAccount posts event payload with internal token",
  withEnv(
    {
      MOAUTH_ACCOUNT_PUBLIC_URL: "http://127.0.0.1:3002",
      MOAUTH_HANDOFF_INTERNAL_TOKEN: "handoff-secret",
    },
    async () => {
      const fetchMock = async (url, init) => {
        assert.equal(url, "http://127.0.0.1:3002/api/internal/audit-events");
        assert.equal(init.method, "POST");
        assert.equal(init.headers.Authorization, "Bearer handoff-secret");
        const body = JSON.parse(init.body);
        assert.equal(body.sub, "user-1");
        assert.equal(body.eventType, AUDIT_EVENT_TYPES.CONSENT_GRANTED);
        return {
          ok: true,
          status: 200,
          json: async () => ({ status: "AUDIT_EVENT_RECORDED" }),
        };
      };

      const result = await recordAuditEventFromAccount(
        {
          sub: "user-1",
          eventType: AUDIT_EVENT_TYPES.CONSENT_GRANTED,
          summary: "授权 SubBoost 访问账号信息",
          metadata: { clientId: "client-a" },
        },
        { fetch: fetchMock }
      );
      assert.equal(result.status, "AUDIT_EVENT_RECORDED");
    }
  )
);