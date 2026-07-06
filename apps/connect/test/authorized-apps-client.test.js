import assert from "node:assert/strict";
import test from "node:test";

import {
  checkAuthorizedAppFromAccount,
  recordAuthorizedAppFromAccount,
} from "../src/authorized-apps/account-client.js";

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
  "recordAuthorizedAppFromAccount posts grant payload with internal token",
  withEnv(
    {
      MOAUTH_ACCOUNT_PUBLIC_URL: "http://127.0.0.1:3002",
      MOAUTH_HANDOFF_INTERNAL_TOKEN: "handoff-secret",
    },
    async () => {
      const fetchMock = async (url, init) => {
        assert.equal(url, "http://127.0.0.1:3002/api/internal/authorized-apps");
        assert.equal(init.method, "POST");
        assert.equal(init.headers.Authorization, "Bearer handoff-secret");
        const body = JSON.parse(init.body);
        assert.equal(body.sub, "user-1");
        assert.equal(body.clientId, "client-a");
        return {
          ok: true,
          status: 200,
          json: async () => ({ status: "AUTHORIZED_APP_RECORDED" }),
        };
      };

      const result = await recordAuthorizedAppFromAccount(
        {
          sub: "user-1",
          clientId: "client-a",
          displayName: "App A",
          scopes: ["openid", "profile"],
        },
        { fetch: fetchMock }
      );
      assert.equal(result.status, "AUTHORIZED_APP_RECORDED");
    }
  )
);

test(
  "checkAuthorizedAppFromAccount queries Account internal check endpoint",
  withEnv(
    {
      MOAUTH_ACCOUNT_PUBLIC_URL: "http://127.0.0.1:3002",
      MOAUTH_HANDOFF_INTERNAL_TOKEN: "handoff-secret",
    },
    async () => {
      const fetchMock = async (url, init) => {
        assert.match(url, /^http:\/\/127\.0\.0\.1:3002\/api\/internal\/authorized-apps\?/);
        assert.match(url, /sub=user-1/);
        assert.match(url, /clientId=client-a/);
        assert.match(url, /scopes=openid%2Cprofile/);
        assert.equal(init.method, "GET");
        assert.equal(init.headers.Authorization, "Bearer handoff-secret");
        return {
          ok: true,
          status: 200,
          json: async () => ({ status: "AUTHORIZED_APP_CHECK", granted: true }),
        };
      };

      const granted = await checkAuthorizedAppFromAccount(
        { sub: "user-1", clientId: "client-a", scopes: ["openid", "profile"] },
        { fetch: fetchMock }
      );
      assert.equal(granted, true);
    }
  )
);